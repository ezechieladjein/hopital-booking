<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use FedaPay\FedaPay;
use FedaPay\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Mail\PaymentSuccessfulMail;
use App\Mail\PaymentFailedMail;
use App\Mail\RefundEffectedMail;
use App\Mail\PaymentLinkMail;

class PaymentController extends Controller
{
    public function __construct()
    {
        FedaPay::setApiKey(config('services.fedapay.secret'));
        FedaPay::setEnvironment(config('services.fedapay.environment', 'sandbox'));
    }

    /**
     * Génère un lien de paiement FedaPay
     * POST /api/payments/initiate
     */
    public function initiatePayment(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
        ]);

        try {
            $appointment = Appointment::with(['patient', 'slot.doctor'])->findOrFail($request->appointment_id);

            if ($appointment->amount_to_pay <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le reste à charge pour ce rendez-vous est déjà nul.'
                ], 400);
            }

            $origin = $request->header('Origin') ?? $request->header('Referer');
            $frontendUrl = rtrim($origin ?? env('FRONTEND_URL', 'http://localhost:5173'), '/');

            // 1. Créer la transaction sur FedaPay
            $transaction = Transaction::create([
                'description' => "Règlement consultation Medigo - RDV #{$appointment->id}",
                'amount' => (int) $appointment->amount_to_pay,
                'currency' => ['iso' => 'XOF'],
                'callback_url' => "{$frontendUrl}/payment-callback?appointment_id={$appointment->id}",
                'customer' => [
                    'firstname' => $appointment->patient->prenom ?? 'Patient',
                    'lastname' => $appointment->patient->nom ?? 'Medigo',
                    'email' => $appointment->patient->email ?? 'patient@medigo.bj',
                ]
            ]);

            // 2. Enregistrer la transaction en attente dans la table local `payments`
            Payment::create([
                'appointment_id' => $appointment->id,
                'fedapay_transaction_id' => $transaction->id,
                'payment_method' => 'mobile_money',
                'amount_paid' => (int) $appointment->amount_to_pay,
                'status' => 'pending',
            ]);

            $token = $transaction->generateToken();

            // 📩 ENVOI EMAIL : Lien de paiement
            if ($appointment->patient && $appointment->patient->email) {
                Mail::to($appointment->patient->email)
                    ->queue(new PaymentLinkMail($appointment, $token->url));
            }

            return response()->json([
                'success' => true,
                'payment_url' => $token->url,
                'transaction_id' => $transaction->id
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur FedaPay : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Vérifie et valide le paiement auprès de l'API FedaPay
     * POST /api/payments/verify
     */
    public function verifyPayment(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'id' => 'required'
        ]);

        try {
            DB::beginTransaction();

            $fedapayTx = Transaction::retrieve($request->id);
            $payment = Payment::where('fedapay_transaction_id', $request->id)->firstOrFail();

            // Chargement de toutes les relations dès le début
            $appointment = Appointment::with(['patient', 'slot.doctor', 'slot.doctor.speciality'])
                ->findOrFail($request->appointment_id);

            if ($fedapayTx->status === 'approved') {
                $payment->update([
                    'status' => 'approved',
                    'payment_method' => $fedapayTx->mode ?? 'mobile_money',
                    'fedapay_receipt_url' => $fedapayTx->receipt_url ?? null,
                ]);

                $appointment->update([
                    'status' => 'CONFIRME'
                ]);

                if ($appointment->slot) {
                    $appointment->slot->update([
                        'status' => 'Occupé',
                        'is_available' => false,
                        'reserved_until' => null,
                    ]);
                }

                DB::commit();

                // Plus besoin de $appointment->load(...) ici !
                if ($appointment->patient && $appointment->patient->email) {
                    Mail::to($appointment->patient->email)
                        ->queue(new PaymentSuccessfulMail($payment));
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Paiement confirmé et rendez-vous validé !'
                ]);
            } else {
                $payment->update(['status' => 'declined']);
                DB::commit();

                // Désormais sécurisé : $appointment->patient est déjà disponible
                if ($appointment->patient && $appointment->patient->email) {
                    Mail::to($appointment->patient->email)
                        ->queue(new PaymentFailedMail($payment));
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Le paiement n\'a pas été approuvé (statut : ' . $fedapayTx->status . ').'
                ], 400);
            }
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur de vérification : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Effectuer un remboursement (Refund)
     * POST /api/payments/refund
     */
    public function refundPayment(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'reason' => 'nullable|string'
        ]);

        try {
            $payment = Payment::where('appointment_id', $request->appointment_id)
                ->where('status', 'approved')
                ->firstOrFail();

            $transaction = Transaction::retrieve($payment->fedapay_transaction_id);
            $transaction->refund();

            DB::beginTransaction();

            $payment->update([
                'status' => 'refunded',
                'refunded_amount' => $payment->amount_paid
            ]);

            $appointment = Appointment::findOrFail($request->appointment_id);
            $appointment->update([
                'status' => 'ANNULE_REMBOURSE',
                'cancellation_reason' => $request->reason ?? 'Remboursement effectué.'
            ]);

            DB::commit();

            // 📩 ENVOI EMAIL : Notification de remboursement
            $appointment->load('patient');
            if ($appointment->patient && $appointment->patient->email) {
                Mail::to($appointment->patient->email)
                    ->queue(new RefundEffectedMail($payment));
            }

            return response()->json([
                'success' => true,
                'message' => 'Remboursement effectué avec succès.'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du remboursement : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook FedaPay
     * POST /api/payments/webhook
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        Log::info('🔔 WEBHOOK RECU !', [
            'headers' => $request->headers->all(),
            'payload' => $request->all()
        ]);

        $signature = $request->header('X-FedaPay-Signature');
        $payload = $request->getContent();

        if (!$this->verifyWebhookSignature($payload, $signature)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $data = $request->all();
        $transactionId = $data['data']['id'] ?? null;

        if (!$transactionId) {
            return response()->json(['error' => 'Missing transaction ID'], 400);
        }

        try {
            DB::beginTransaction();

            $payment = Payment::where('fedapay_transaction_id', $transactionId)->first();
            if (!$payment) {
                return response()->json(['error' => 'Transaction not found'], 404);
            }

            $fedapayTx = Transaction::retrieve($transactionId);
            $appointment = Appointment::with(['patient', 'slot.doctor'])->find($payment->appointment_id);

            if ($fedapayTx->status === 'approved') {
                $payment->update([
                    'status' => 'approved',
                    'payment_method' => $fedapayTx->mode ?? 'mobile_money',
                    'fedapay_receipt_url' => $fedapayTx->receipt_url ?? null,
                ]);

                if ($appointment) {
                    $appointment->update(['status' => 'CONFIRME']);

                    if ($appointment->slot) {
                        $appointment->slot->update([
                            'status' => 'Occupé',
                            'is_available' => false,
                            'reserved_until' => null,
                        ]);
                    }
                }

                DB::commit();

                if ($appointment && $appointment->patient && $appointment->patient->email) {
                    Mail::to($appointment->patient->email)
                        ->queue(new PaymentSuccessfulMail($payment));
                }

                Log::info("Webhook: Paiement approuvé pour le RDV #{$payment->appointment_id}");
            } elseif (in_array($fedapayTx->status, ['declined', 'abandoned'])) {
                $payment->update(['status' => 'declined']);
                DB::commit();

                if ($appointment && $appointment->patient && $appointment->patient->email) {
                    Mail::to($appointment->patient->email)
                        ->queue(new PaymentFailedMail($payment));
                }

                Log::info("Webhook: Paiement échoué pour le RDV #{$payment->appointment_id}");
            }

            return response()->json(['status' => 'ok']);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Webhook error: " . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function verifyWebhookSignature($payload, $signature): bool
    {
        $secret = config('services.fedapay.webhook_secret');
        if (empty($secret)) {
            Log::warning("Webhook secret not configured!");
            return false;
        }

        $computed = hash_hmac('sha256', $payload, $secret);
        return hash_equals($computed, $signature);
    }

    public function getPaymentStatus(Appointment $appointment): JsonResponse
    {
        $payment = Payment::where('appointment_id', $appointment->id)->first();

        if (!$payment) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun paiement trouvé pour ce rendez-vous'
            ], 404);
        }

        return response()->json([
            'success' => $payment->status === 'approved',
            'status' => $payment->status,
            'message' => $payment->status === 'approved'
                ? 'Paiement confirmé'
                : 'Paiement en attente ou échoué'
        ]);
    }
}

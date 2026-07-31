<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use FedaPay\FedaPay;
use FedaPay\Transaction;
use FedaPay\Webhook;
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

            // 2. Enregistrer la transaction en attente dans la table locale `payments`
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
     * Vérifie et valide le paiement auprès de l'API FedaPay (Fallback retour navigateur)
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

            // Vérification locale d'abord
            if ($payment->status === 'approved') {
                DB::commit();
                return response()->json(['success' => true, 'message' => 'Paiement déjà confirmé.']);
            }

            // Si le paiement est encore 'pending' dans la base, on laisse le temps au webhook 
            // d'arriver au lieu de contacter systématiquement l'API FedaPay.
            if ($payment->status === 'pending') {
                DB::commit();
                return response()->json([
                    'success' => false,
                    'message' => 'Paiement en cours de traitement par le fournisseur.'
                ], 202); // 202 Accepted = demande acceptée mais pas encore traitée
            }

            // Sinon, on contacte l'API FedaPay...

            $fedapayTx = Transaction::retrieve($request->id);
            $payment = Payment::where('fedapay_transaction_id', $request->id)->firstOrFail();
            $appointment = Appointment::with(['patient', 'slot.doctor.speciality'])
                ->findOrFail($request->appointment_id);

            // Evite les doubles traitements si déjà approuvé
            if ($payment->status === 'approved') {
                DB::commit();
                return response()->json([
                    'success' => true,
                    'message' => 'Paiement déjà confirmé.'
                ]);
            }

            if ($fedapayTx->status === 'approved') {
                $this->markAsApproved($payment, $appointment, $fedapayTx->mode, $fedapayTx->receipt_url);
                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Paiement confirmé et rendez-vous validé !'
                ]);
            } else {
                $payment->update(['status' => 'declined']);
                DB::commit();

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
     * Webhook FedaPay
     * POST /api/payments/webhook
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $signature = $request->header('X-FedaPay-Signature');

        Log::info('FedaPay WEBHOOK RECU', [
            'event' => $request->input('name'),
            'signature' => $signature,
            'payload' => $request->all(),
        ]);

        Log::info('FedaPay DEBUG Signature', [
            'header_received' => $signature,
            'secret_used' => config('services.fedapay.webhook_secret'),
            'payload' => $payload
        ]);

        // Vérification signature
        if (!$this->verifyWebhookSignature($payload, $signature)) {
            Log::error('Signature Webhook invalide ou non configurée');
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event = $request->input('name');
        $entity = $request->input('entity', []);
        $transactionId = $entity['id'] ?? null;

        if (!$transactionId) {
            return response()->json(['error' => 'Transaction ID missing'], 400);
        }

        try {
            DB::beginTransaction();

            $payment = Payment::where('fedapay_transaction_id', $transactionId)->first();

            if (!$payment) {
                Log::warning('Paiement introuvable', ['transaction_id' => $transactionId]);
                DB::commit();
                return response()->json(['status' => 'ignored']);
            }

            // Ne pas traiter deux fois une transaction déjà validée
            if ($payment->status === 'approved') {
                DB::commit();
                return response()->json(['status' => 'already_processed']);
            }

            $appointment = Appointment::with(['patient', 'slot.doctor'])->find($payment->appointment_id);

            $status = $entity['status'] ?? null;

            if ($event === 'transaction.approved' || ($event === 'transaction.update' && $status === 'approved')) {
                $this->markAsApproved(
                    $payment,
                    $appointment,
                    $entity['mode'] ?? null,
                    $entity['receipt_url'] ?? null
                );
            } elseif (in_array($event, ['transaction.declined', 'transaction.canceled'])) {
                $payment->update(['status' => 'declined']);
                if ($appointment?->patient && $appointment->patient->email) {
                    Mail::to($appointment->patient->email)->queue(new PaymentFailedMail($payment));
                }
            }

            DB::commit();
            return response()->json(['status' => 'ok']);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Erreur traitement webhook FedaPay', ['message' => $e->getMessage()]);
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }

    /**
     * Méthode privée pour centraliser la validation du rendez-vous
     */
    private function markAsApproved(Payment $payment, ?Appointment $appointment, ?string $mode, ?string $receiptUrl): void
    {
        $payment->update([
            'status' => 'approved',
            'payment_method' => $this->normalizePaymentMethod($mode),
            'fedapay_receipt_url' => $receiptUrl,
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

            if ($appointment->patient && $appointment->patient->email) {
                Mail::to($appointment->patient->email)->queue(new PaymentSuccessfulMail($appointment));
            }
        }
    }

    /**
     * Vérification de signature conforme à FedaPay
     */
    private function verifyWebhookSignature(string $payload, ?string $signature): bool
    {
        $secret = config('services.fedapay.webhook_secret');

        if (empty($secret) || empty($signature)) {
            Log::error('FedaPay webhook secret ou signature manquant.');
            return false;
        }

        // Calculez le HMAC-SHA256 du payload brut reçu
        $expectedSignature = hash_hmac('sha256', $payload, $secret);

        // Comparez de manière sécurisée (anti-timing attack)
        return hash_equals($expectedSignature, $signature);
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
            'message' => $payment->status === 'approved' ? 'Paiement confirmé' : 'Paiement en attente ou échoué'
        ]);
    }

    private function normalizePaymentMethod(?string $mode): string
    {
        return match ($mode) {
            'momo_test', 'mtn', 'mtn_ci', 'mtn_open', 'mtn_ecw', 'moov', 'moov_ci', 'moov_bf' => 'mobile_money',
            'gim_uemoa_card', 'cybersource', 'stripe_gw' => 'card',
            default => 'mobile_money',
        };
    }
}

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
            $appointment = Appointment::with('patient')->findOrFail($request->appointment_id);

            if ($appointment->amount_to_pay <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le reste à charge pour ce rendez-vous est déjà nul.'
                ], 400);
            }

            // Détection dynamique de l'URL frontend du client (gestion des ports Vite 5173, 5174, etc.)
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
                'payment_method' => 'mobile_money', // valeur par défaut, mise à jour au callback
                'amount_paid' => (int) $appointment->amount_to_pay,
                'status' => 'pending',
            ]);

            $token = $transaction->generateToken();

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
            'id' => 'required' // ID de transaction envoyé par FedaPay dans l'URL ?id=xxx
        ]);

        try {
            DB::beginTransaction();

            // 1. Récupérer la transaction en direct depuis les serveurs FedaPay
            $fedapayTx = Transaction::retrieve($request->id);
            $payment = Payment::where('fedapay_transaction_id', $request->id)->firstOrFail();
            $appointment = Appointment::findOrFail($request->appointment_id);

            // 2. Sécurité : Vérifier le statut réel de la transaction auprès de FedaPay
            if ($fedapayTx->status === 'approved') {
                
                // Mise à jour du paiement local
                $payment->update([
                    'status' => 'approved',
                    'payment_method' => $fedapayTx->mode ?? 'mobile_money',
                    'fedapay_receipt_url' => $fedapayTx->receipt_url ?? null,
                ]);

                // Validation du rendez-vous
                $appointment->update([
                    'status' => 'CONFIRME'
                ]);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Paiement confirmé et rendez-vous validé !'
                ]);
            } else {
                $payment->update(['status' => 'declined']);
                DB::commit();

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

            // Appel à l'API FedaPay pour effectuer le remboursement
            $transaction = Transaction::retrieve($payment->fedapay_transaction_id);
            
            // FedaPay Refund API call
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
}
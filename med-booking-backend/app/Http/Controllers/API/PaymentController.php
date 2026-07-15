<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use FedaPay\FedaPay;
use FedaPay\Transaction;

class PaymentController extends Controller
{
    public function __construct()
    {
        // Initialisation automatique de la configuration FedaPay
        FedaPay::setApiKey(config('services.fedapay.secret'));
        FedaPay::setEnvironment(config('services.fedapay.environment', 'sandbox'));
    }

    /**
     * Génère un lien de paiement FedaPay pour un rendez-vous spécifique.
     * URL : POST /api/payments/initiate
     */
    public function initiatePayment(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
        ]);

        try {
            // 1. Récupérer le rendez-vous avec les informations du patient
            $appointment = Appointment::with('patient')->findOrFail($request->appointment_id);

            // Sécurité : s'assurer que le montant à payer est supérieur à 0
            if ($appointment->amount_to_pay <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le reste à charge pour ce rendez-vous est déjà nul.'
                ], 400);
            }

            // 2. Créer la transaction FedaPay
            $transaction = Transaction::create([
                'description' => "Règlement consultation Medigo - RDV #{$appointment->id}",
                'amount' => (int) $appointment->amount_to_pay,
                'currency' => ['iso' => 'XOF'], // FCFA
                'callback_url' => "http://localhost:5173/payment-callback?appointment_id={$appointment->id}", // Retour vers le frontend React
                'customer' => [
                    'firstname' => $appointment->patient->prenom ?? 'Patient',
                    'lastname' => $appointment->patient->nom ?? 'Medigo',
                    'email' => $appointment->patient->email ?? 'patient@medigo.bj',
                ]
            ]);

            // 3. Générer le jeton de paiement pour obtenir l'URL de redirection
            $token = $transaction->generateToken();

            return response()->json([
                'success' => true,
                'payment_url' => $token->url, // URL sur laquelle envoyer le patient
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
     * Valide le paiement après redirection (Callback simple pour le dev local)
     * URL : POST /api/payments/callback-handler
     */
    public function callbackHandler(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'status' => 'required|string' // Reçu de FedaPay (ex: "approved")
        ]);

        try {
            $appointment = Appointment::findOrFail($request->appointment_id);

            if ($request->status === 'approved') {
                $appointment->update([
                    'status' => 'CONFIRME'
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Le rendez-vous a été marqué comme payé et validé avec succès !'
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Le paiement n\'a pas pu être approuvé.'
            ], 400);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du traitement du retour : ' . $e->getMessage()
            ], 500);
        }
    }
}

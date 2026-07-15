<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SecretaryController extends Controller
{
    /**
     * 1. Liste de tous les rendez-vous pour la secrétaire.
     * URL: GET /api/secretary/appointments
     */
    public function index(): JsonResponse
    {
        try {
            // On récupère les rendez-vous avec les relations indispensables
            $appointments = Appointment::with(['patient', 'slot.doctor'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $appointments
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur de récupération : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 2. Validation de l'assurance et calcul du reste à charge.
     * URL: POST /api/secretary/appointments/{id}/validate-insurance
     */
    public function validateInsurance(Request $request): JsonResponse
    {
        // 1. On récupère l'ID du rendez-vous depuis le corps de la requête React
        $appointmentId = $request->input('appointment_id') ?? $request->input('id');

        // On récupère également le taux de couverture envoyé par la secrétaire (ex: 80)
        $coverageRate = $request->input('insurance_coverage_rate');

        if (!$appointmentId) {
            return response()->json([
                'success' => false,
                'message' => "L'identifiant du rendez-vous est requis."
            ], 400);
        }

        try {
            // 2. Trouver le rendez-vous concerné
            $appointment = Appointment::find($appointmentId);

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Rendez-vous introuvable.'
                ], 404);
            }

            // 3. Calcul du nouveau montant après application de la couverture d'assurance
            $basePrice = $appointment->base_price; // 25 000 XOF

            // Si le taux est de 80%, le patient paie les 20% restants (ticket modérateur)
            $factor = (100 - (int)$coverageRate) / 100;
            $amountToPay = $basePrice * $factor; // Ex: 25000 * 0.2 = 5000 XOF

            // 4. Mise à jour du rendez-vous
            $appointment->update([
                'insurance_coverage_rate' => $coverageRate,
                'amount_to_pay'           => $amountToPay,
                'status'                  => 'EN_ATTENTE_PAIEMENT', // On débloque le paiement
            ]);

            return response()->json([
                'success' => true,
                'message' => 'L\'assurance a été validée avec succès ! Le montant restant dû a été mis à jour.',
                'data' => [
                    'amount_to_pay' => $amountToPay,
                    'status' => 'EN_ATTENTE_PAIEMENT'
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la validation : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 3. Clôture ou mise à jour du statut final du rendez-vous.
     * URL: POST /api/secretary/appointments/{id}/status
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|string|in:Confirmé,Terminé,Absent,Annulé'
        ]);

        try {
            $appointment = Appointment::findOrFail($id);
            $appointment->update(['status' => $request->input('status')]);

            return response()->json([
                'success' => true,
                'message' => 'Statut du rendez-vous mis à jour avec succès.',
                'data' => $appointment
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()
            ], 500);
        }
    }
}

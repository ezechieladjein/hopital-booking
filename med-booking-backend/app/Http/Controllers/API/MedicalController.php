<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Speciality;
use App\Models\Slot;
use App\Models\Appointment;
use App\Models\Doctor; // <-- C'est cette ligne qui résout le "Undefined type" !
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MedicalController extends Controller
{
    /**
     * 1. Récupère le catalogue complet des spécialités avec leurs médecins actifs.
     * URL : GET /api/catalog
     */
    // Dans app/Http/Controllers/API/MedicalController.php

    public function getCatalog(): JsonResponse
    {
        try {
            // 🚀 On ajoute 'doctors.slots' pour charger les créneaux en même temps !
            $catalog = Speciality::with([
                'doctors' => function ($query) {
                    $query->where('status', 'actif');
                },
                'doctors.slots' => function ($query) {
                    // Optionnel : charger uniquement les créneaux futurs et disponibles
                    $query->where('status', 'Disponible');
                }
            ])
                ->where('is_active', true)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $catalog
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération du catalogue : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 2. Récupère les créneaux disponibles d'un médecin pour une date spécifique.
     * URL : GET /api/doctors/{id}/slots?date=YYYY-MM-DD
     */
    public function getDoctorSlots(int $doctorId): JsonResponse
    {
        $date = request()->query('date');

        if (!$date) {
            return response()->json([
                'success' => false,
                'message' => 'La date est requise (format: YYYY-MM-DD).'
            ], 400);
        }

        try {
            $slots = Slot::where('doctor_id', $doctorId)
                ->where('date_consultation', $date)
                ->where('status', 'Disponible')
                ->orderBy('start_time', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $slots
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des créneaux : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 3. Enregistre un rendez-vous et verrouille le créneau associé de manière dynamique.
     * URL : POST /api/appointments
     */
    // Dans app/Http/Controllers/API/MedicalController.php

    public function bookAppointment(): JsonResponse
    {
        // 1. Validation des données de base
        $slotId = request()->input('slot_id');
        $keycloakUuid = request()->input('keycloak_uuid');
        $email = request()->input('email');
        $nom = request()->input('nom');
        $prenom = request()->input('prenom');

        $hasInsurance = request()->input('has_insurance') === 'true' || request()->input('has_insurance') === true;
        $insuranceName = request()->input('insurance_name');
        $insurancePolicyNumber = request()->input('insurance_policy_number');

        // 🚀 Gestion de l'upload du document d'assurance
        $documentPath = null;
        if ($hasInsurance && request()->hasFile('insurance_document')) {
            $file = request()->file('insurance_document');
            // On sauvegarde dans le dossier 'storage/app/public/insurances'
            $path = $file->store('insurances', 'public');
            // On génère l'URL publique d'accès au fichier
            $documentPath = asset('storage/' . $path);
        }

        if (!$slotId || !$keycloakUuid) {
            return response()->json([
                'success' => false,
                'message' => 'L\'ID du créneau et le keycloak_uuid sont requis.'
            ], 400);
        }

        DB::beginTransaction();

        try {
            $user = \App\Models\User::firstOrCreate(
                ['keycloak_uuid' => $keycloakUuid],
                [
                    'nom' => $nom ?? 'Nom',
                    'prenom' => $prenom ?? 'Prénom',
                    'email' => $email ?? 'sans-email@example.com',
                    'role' => 'patient',
                ]
            );

            $slot = Slot::lockForUpdate()->find($slotId);

            if (!$slot) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Créneau introuvable.'], 404);
            }

            if ($slot->status !== 'Disponible') {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Désolé, ce créneau a déjà été réservé.'], 422);
            }

            $slot->update(['status' => 'Réservé temporairement']);

            $initialStatus = $hasInsurance ? 'EN_ATTENTE_VALIDATION' : 'EN_ATTENTE_PAIEMENT';

            // 🚀 Enregistrement avec le chemin du document
            $appointment = Appointment::create([
                'patient_id'              => $user->id,
                'slot_id'                 => $slot->id,
                'status'                  => $initialStatus,
                'has_insurance'           => $hasInsurance,
                'insurance_name'          => $hasInsurance ? $insuranceName : null,
                'insurance_policy_number' => $hasInsurance ? $insurancePolicyNumber : null,
                'insurance_document_path' => $documentPath, // Sauvegarde de l'URL du fichier
                'base_price'              => 25000,
                'amount_to_pay'           => 25000,
            ]);

            DB::commit();

            return response()->json([
                'appointment_id' => $appointment->id,
                'success' => true,
                'message' => 'Votre rendez-vous a été enregistré avec succès !',
                'data' => [
                    'date' => $slot->date_consultation,
                    'heure' => substr($slot->start_time, 0, 5),
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'DÉBOGAGE : ' . $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }
    public function getAvailableDays(Doctor $doctor)
    {
        // Récupère toutes les dates distinctes des créneaux libres de ce médecin à partir d'aujourd'hui
        $days = $doctor->slots()
            ->where('is_booked', false)
            /* ->where('date', '>=', now()->toDateString()) */
            ->orderBy('date', 'asc')
            ->pluck('date')
            ->unique()
            ->values();

        return response()->json([
            'success' => true,
            'data' => $days
        ]);
    }
}

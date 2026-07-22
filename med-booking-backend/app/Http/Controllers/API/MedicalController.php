<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Speciality;
use App\Models\Slot;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\User;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use FedaPay\FedaPay;
use FedaPay\Transaction;
use Carbon\Carbon;

class MedicalController extends Controller
{
    /**
     * Récupère le catalogue des spécialités et médecins actifs.
     */
    public function getCatalog(): JsonResponse
    {
        try {
            $catalog = Speciality::with([
                'doctors' => fn($q) => $q->where('status', 'actif'),
                'doctors.slots' => fn($q) => $q->where('status', 'Disponible')
            ])
            ->where('is_active', true)
            ->get();

            return response()->json(['success' => true, 'data' => $catalog], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère les créneaux disponibles d'un médecin à une date donnée.
     */
    public function getDoctorSlots(int $doctorId): JsonResponse
    {
        $date = request()->query('date');

        if (!$date) {
            return response()->json(['success' => false, 'message' => 'La date est requise.'], 400);
        }

        try {
            $slots = Slot::where('doctor_id', $doctorId)
                ->where('date_consultation', $date)
                ->where('status', 'Disponible')
                ->orderBy('start_time', 'asc')
                ->get();

            return response()->json(['success' => true, 'data' => $slots], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Enregistre un nouveau rendez-vous.
     */
    public function bookAppointment(): JsonResponse
    {
        $slotId = request()->input('slot_id');
        $keycloakUuid = request()->input('keycloak_uuid');
        $email = request()->input('email');
        $nom = request()->input('nom');
        $prenom = request()->input('prenom');

        $hasInsurance = filter_var(request()->input('has_insurance'), FILTER_VALIDATE_BOOLEAN);
        $insuranceName = request()->input('insurance_name');
        $insurancePolicyNumber = request()->input('insurance_policy_number');

        $documentPath = null;
        if ($hasInsurance && request()->hasFile('insurance_document')) {
            $path = request()->file('insurance_document')->store('insurances', 'public');
            $documentPath = asset('storage/' . $path);
        }

        if (!$slotId || !$keycloakUuid) {
            return response()->json(['success' => false, 'message' => 'Identifiants invalides.'], 400);
        }

        DB::beginTransaction();

        try {
            $user = User::firstOrCreate(
                ['keycloak_uuid' => $keycloakUuid],
                [
                    'nom' => $nom ?? 'Nom',
                    'prenom' => $prenom ?? 'Prénom',
                    'email' => $email ?? 'sans-email@example.com',
                    'role' => 'patient',
                ]
            );

            $slot = Slot::lockForUpdate()->with('doctor.speciality')->find($slotId);

            if (!$slot || $slot->status !== 'Disponible') {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Ce créneau n\'est plus disponible.'], 422);
            }

            $basePrice = $slot->doctor->speciality->tarif ?? 25000;

            $slot->update(['status' => 'Réservé temporairement']);

            $initialStatus = $hasInsurance ? 'EN_ATTENTE_VALIDATION' : 'EN_ATTENTE_PAIEMENT';

            $appointment = Appointment::create([
                'patient_id' => $user->id,
                'slot_id' => $slot->id,
                'status' => $initialStatus,
                'has_insurance' => $hasInsurance,
                'insurance_name' => $hasInsurance ? $insuranceName : null,
                'insurance_policy_number' => $hasInsurance ? $insurancePolicyNumber : null,
                'insurance_document_path' => $documentPath,
                'insurance_coverage_rate' => 0,
                'base_price' => $basePrice,
                'amount_to_pay' => $basePrice,
            ]);

            DB::commit();

            return response()->json([
                'appointment_id' => $appointment->id,
                'success' => true,
                'message' => 'Rendez-vous enregistré avec succès !',
                'data' => [
                    'date' => $slot->date_consultation,
                    'heure' => substr($slot->start_time, 0, 5),
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère tous les RDV d'un patient connecté.
     */
    public function getPatientAppointments(string $keycloakUuid): JsonResponse
    {
        try {
            $user = User::where('keycloak_uuid', $keycloakUuid)->first();

            if (!$user) {
                return response()->json(['success' => true, 'data' => [], 'user' => null]);
            }

            $appointments = Appointment::with(['slot.doctor.speciality', 'payments'])
                ->where('patient_id', $user->id)
                ->orderBy('id', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'user' => $user,
                'data' => $appointments
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Modification / Report d'un rendez-vous.
     */
    public function rescheduleAppointment(int $id): JsonResponse
    {
        $newSlotId = request()->input('slot_id');

        if (!$newSlotId) {
            return response()->json(['success' => false, 'message' => 'Le paramètre slot_id est requis.'], 400);
        }

        DB::beginTransaction();

        try {
            $appointment = Appointment::with(['slot.doctor.speciality'])->find($id);

            if (!$appointment) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Rendez-vous introuvable.'], 404);
            }

            $newSlot = Slot::lockForUpdate()->with('doctor.speciality')->find($newSlotId);

            if (!$newSlot || $newSlot->status !== 'Disponible') {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Le créneau choisi n\'est pas disponible.'], 422);
            }

            // CAS 1 : SI CONFIRMÉ (PAYÉ) -> Interdiction de changer de spécialité
            if ($appointment->status === 'CONFIRME') {
                $currentSpecialityId = $appointment->slot->doctor->speciality_id;
                $newSpecialityId = $newSlot->doctor->speciality_id;

                if ($currentSpecialityId !== $newSpecialityId) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Impossible de changer de spécialité une fois le paiement effectué.'
                    ], 422);
                }

                $appointment->slot->update(['status' => 'Disponible']);
                $newSlot->update(['status' => 'Réservé temporairement']);
                $appointment->update(['slot_id' => $newSlot->id]);

                DB::commit();
                return response()->json(['success' => true, 'message' => 'Rendez-vous déplacé avec succès.'], 200);
            }

            // CAS 2 : SI EN ATTENTE -> recalcul dynamique du prix et conservation du taux d'assurance
            if (in_array($appointment->status, ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_VALIDATION'])) {
                if ($appointment->slot) {
                    $appointment->slot->update(['status' => 'Disponible']);
                }

                $newBasePrice = $newSlot->doctor->speciality->tarif ?? $appointment->base_price;
                $coverageRate = $appointment->insurance_coverage_rate ?? 0;
                $newAmountToPay = $newBasePrice * (1 - ($coverageRate / 100));

                $newSlot->update(['status' => 'Réservé temporairement']);

                $appointment->update([
                    'slot_id' => $newSlot->id,
                    'base_price' => $newBasePrice,
                    'amount_to_pay' => (int) $newAmountToPay,
                ]);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Rendez-vous et montant recalculés avec succès.',
                    'data' => [
                        'base_price' => $newBasePrice,
                        'amount_to_pay' => $newAmountToPay
                    ]
                ], 200);
            }

            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Ce rendez-vous ne peut plus être modifié.'], 400);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Annulation d'un rendez-vous.
     */
    public function cancelAppointment(int $id): JsonResponse
    {
        $reason = request()->input('reason', 'Annulé par le patient');

        DB::beginTransaction();

        try {
            $appointment = Appointment::with(['slot', 'payments'])->find($id);

            if (!$appointment) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Rendez-vous introuvable.'], 404);
            }

            if (in_array($appointment->status, ['ANNULE_PATIENT', 'ANNULE_HOPITAL'])) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Rendez-vous déjà annulé.'], 400);
            }

            // Libération du créneau
            if ($appointment->slot) {
                $appointment->slot->update(['status' => 'Disponible']);
            }

            // CAS 1 : Non payé -> Annulation directe sans remboursement
            if (in_array($appointment->status, ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_VALIDATION'])) {
                $appointment->update([
                    'status' => 'ANNULE_PATIENT',
                    'cancellation_reason' => $reason
                ]);

                DB::commit();
                return response()->json(['success' => true, 'message' => 'Rendez-vous annulé avec succès.'], 200);
            }

            // CAS 2 : Déjà payé (CONFIRME)
            if ($appointment->status === 'CONFIRME') {
                $appointmentDate = Carbon::parse($appointment->slot->date_consultation);

                if ($appointmentDate->isToday()) {
                    $appointment->update([
                        'status' => 'ANNULE_PATIENT',
                        'cancellation_reason' => $reason . ' (Jour même : Non remboursé)'
                    ]);

                    DB::commit();
                    return response()->json([
                        'success' => true,
                        'message' => 'Rendez-vous annulé. Aucun remboursement n\'est appliqué le jour même.'
                    ], 200);
                }

                // Remboursement 100% via FedaPay
                $approvedPayment = $appointment->payments()->where('status', 'approved')->first();

                if ($approvedPayment) {
                    FedaPay::setApiKey(config('services.fedapay.secret'));
                    FedaPay::setEnvironment(config('services.fedapay.environment', 'sandbox'));

                    $transaction = Transaction::retrieve($approvedPayment->fedapay_transaction_id);
                    $transaction->refund();

                    $approvedPayment->update([
                        'status' => 'refunded',
                        'refunded_amount' => $approvedPayment->amount_paid
                    ]);
                }

                $appointment->update([
                    'status' => 'ANNULE_PATIENT',
                    'cancellation_reason' => $reason . ' (Remboursement intégral 100%)'
                ]);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Rendez-vous annulé et remboursement à 100% initié.'
                ], 200);
            }

            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Statut non annulable.'], 400);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Mise à jour du profil du patient.
     */
    public function updateProfile(string $keycloakUuid): JsonResponse
    {
        try {
            $user = User::where('keycloak_uuid', $keycloakUuid)->firstOrFail();

            $user->update([
                'nom' => request()->input('nom', $user->nom),
                'prenom' => request()->input('prenom', $user->prenom),
                'email' => request()->input('email', $user->email),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Profil mis à jour avec succès.',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getAvailableDays(Doctor $doctor): JsonResponse
    {
        $days = $doctor->slots()
            ->where('status', 'Disponible')
            ->orderBy('date_consultation', 'asc')
            ->pluck('date_consultation')
            ->unique()
            ->values();

        return response()->json(['success' => true, 'data' => $days]);
    }
}
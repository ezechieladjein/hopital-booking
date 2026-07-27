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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\AppointmentCreatedMail;
use App\Mail\AppointmentUpdatedMail;
use App\Mail\AppointmentCancelledMail;
use FedaPay\FedaPay;
use FedaPay\Transaction;
use Carbon\Carbon;
use Exception;

class MedicalController extends Controller
{
    /**
     * Récupère le catalogue des spécialités et médecins actifs avec créneaux futurs uniquement.
     */
    public function getCatalog(): JsonResponse
    {
        try {
            $now = Carbon::now();

            $catalog = Speciality::with([
                'doctors' => fn($q) => $q->where('status', 'actif'),
                'doctors.slots' => fn($q) => $q->where('status', 'Disponible')
                    ->where(function ($query) use ($now) {
                        $query->where('date_consultation', '>', $now->toDateString())
                            ->orWhere(function ($sub) use ($now) {
                                $sub->where('date_consultation', '=', $now->toDateString())
                                    ->where('start_time', '>', $now->toTimeString());
                            });
                    })
            ])
                ->where('is_active', true)
                ->get();

            return response()->json(['success' => true, 'data' => $catalog], 200);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère les créneaux disponibles d'un médecin à une date donnée.
     */
    public function getDoctorSlots(Request $request, int $doctorId): JsonResponse
    {
        $date = $request->query('date');

        if (!$date) {
            return response()->json(['success' => false, 'message' => 'La date est requise.'], 400);
        }

        try {
            $now = Carbon::now();

            $slotsQuery = Slot::where('doctor_id', $doctorId)
                ->where('date_consultation', $date)
                ->where('status', 'Disponible');

            // Si c'est aujourd'hui, masquer les heures déjà dépassées
            if ($date === $now->toDateString()) {
                $slotsQuery->where('start_time', '>', $now->toTimeString());
            }

            $slots = $slotsQuery->orderBy('start_time', 'asc')->get();

            return response()->json(['success' => true, 'data' => $slots], 200);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Enregistre un nouveau rendez-vous.
     */
    public function bookAppointment(Request $request): JsonResponse
    {
        $slotId = $request->input('slot_id');
        $keycloakUuid = $request->input('keycloak_uuid');
        $email = $request->input('email');
        $nom = $request->input('nom');
        $prenom = $request->input('prenom');

        $hasInsurance = filter_var($request->input('has_insurance'), FILTER_VALIDATE_BOOLEAN);
        $insuranceName = $request->input('insurance_name');
        $insurancePolicyNumber = $request->input('insurance_policy_number');

        $documentPath = null;
        if ($hasInsurance && $request->hasFile('insurance_document')) {
            $path = $request->file('insurance_document')->store('insurances', 'public');
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

            // Verrouillage du créneau avec les colonnes étendues
            $slot->update([
                'status' => 'Réservé temporairement',
                'is_available' => false,
                'reserved_until' => Carbon::now()->addHours(24)
            ]);

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
            $appointment->load(['patient', 'slot.doctor', 'slot.doctor.speciality']);
            // 📩 ENVOI EMAIL : Confirmation de réservation
            Mail::to($user->email)->queue(new AppointmentCreatedMail($appointment));

            return response()->json([
                'appointment_id' => $appointment->id,
                'success' => true,
                'message' => 'Rendez-vous enregistré avec succès !',
                'data' => [
                    'date' => $slot->date_consultation,
                    'heure' => substr($slot->start_time, 0, 5),
                ]
            ], 201);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère tous les RDV d'un patient connecté via son keycloak_uuid.
     */
    public function getPatientAppointments(string $keycloakUuid): JsonResponse
    {
        try {
            $user = User::where('keycloak_uuid', $keycloakUuid)
                ->where('role', 'patient')
                ->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Utilisateur introuvable.'
                ], 404);
            }

            $appointments = Appointment::with(['slot.doctor.speciality'])
                ->where('patient_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'user' => [
                    'nom' => $user->nom,
                    'prenom' => $user->prenom,
                    'email' => $user->email,
                ],
                'data' => $appointments
            ], 200);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Modification / Report complet d'un rendez-vous.
     */
    public function rescheduleAppointment(Request $request, int $id): JsonResponse
    {
        $newSlotId = $request->input('slot_id');
        $hasInsurance = filter_var($request->input('has_insurance'), FILTER_VALIDATE_BOOLEAN);
        $insuranceName = $request->input('insurance_name');
        $insurancePolicyNumber = $request->input('insurance_policy_number');

        if (!$newSlotId) {
            return response()->json(['success' => false, 'message' => 'Le créneau (slot_id) est requis.'], 400);
        }

        DB::beginTransaction();

        try {
            $appointment = Appointment::with(['patient', 'slot.doctor.speciality', 'slot.doctor'])->find($id);

            if (!$appointment) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Rendez-vous introuvable.'], 404);
            }

            // CAS 1 : SI CONFIRMÉ (PAYÉ) -> Interdiction de changer de spécialité
            if ($appointment->status === 'CONFIRME') {
                $newSlot = Slot::lockForUpdate()->with('doctor.speciality')->find($newSlotId);

                if (!$newSlot || $newSlot->status !== 'Disponible') {
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => 'Le créneau choisi n\'est plus disponible.'], 422);
                }

                if ($appointment->slot->doctor->speciality_id !== $newSlot->doctor->speciality_id) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Impossible de changer de spécialité une fois le paiement effectué.'
                    ], 422);
                }

                // Libération de l'ancien créneau
                if ($appointment->slot) {
                    $this->releaseSlot($appointment->slot);
                }

                // Réservation du nouveau créneau (Conserve le statut CONFIRME)
                $newSlot->update([
                    'status' => 'Occupé',
                    'is_available' => false,
                    'reserved_until' => null,
                ]);

                $appointment->update(['slot_id' => $newSlot->id]);

                DB::commit();

                // 📩 ENVOI EMAIL : Modification du rendez-vous
                Mail::to($appointment->patient->email)->queue(new AppointmentUpdatedMail($appointment));

                return response()->json(['success' => true, 'message' => 'Créneau modifié avec succès.'], 200);
            }

            // CAS 2 : EN ATTENTE (VALIDATION OU PAIEMENT) -> Modification complète autorisée
            if (in_array($appointment->status, ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_VALIDATION'])) {
                $newSlot = Slot::lockForUpdate()->with('doctor.speciality')->find($newSlotId);

                if (!$newSlot || ($newSlot->id !== $appointment->slot_id && $newSlot->status !== 'Disponible')) {
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => 'Le créneau choisi n\'est pas disponible.'], 422);
                }

                // Gestion du fichier d'assurance
                $documentPath = $appointment->insurance_document_path;
                if ($hasInsurance && $request->hasFile('insurance_document')) {
                    $path = $request->file('insurance_document')->store('insurances', 'public');
                    $documentPath = asset('storage/' . $path);
                } elseif (!$hasInsurance) {
                    $documentPath = null;
                }

                // Libérer l'ancien créneau si changement
                if ($appointment->slot && $appointment->slot_id !== $newSlot->id) {
                    $this->releaseSlot($appointment->slot);

                    $newSlot->update([
                        'status' => 'Réservé temporairement',
                        'is_available' => false,
                        'reserved_until' => Carbon::now()->addHours(24)
                    ]);
                }

                $newBasePrice = $newSlot->doctor->speciality->tarif ?? $appointment->base_price;
                $coverageRate = $appointment->insurance_coverage_rate ?? 0;
                $newAmountToPay = $newBasePrice * (1 - ($coverageRate / 100));

                $newStatus = $hasInsurance ? 'EN_ATTENTE_VALIDATION' : 'EN_ATTENTE_PAIEMENT';

                $appointment->update([
                    'slot_id' => $newSlot->id,
                    'status' => $newStatus,
                    'has_insurance' => $hasInsurance,
                    'insurance_name' => $hasInsurance ? $insuranceName : null,
                    'insurance_policy_number' => $hasInsurance ? $insurancePolicyNumber : null,
                    'insurance_document_path' => $documentPath,
                    'base_price' => $newBasePrice,
                    'amount_to_pay' => (int) $newAmountToPay,
                ]);

                DB::commit();

                // 📩 ENVOI EMAIL : Modification du rendez-vous
                Mail::to($appointment->patient->email)->queue(new AppointmentUpdatedMail($appointment));

                return response()->json([
                    'success' => true,
                    'message' => 'Rendez-vous et informations mis à jour avec succès.',
                    'data' => $appointment
                ], 200);
            }

            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Ce rendez-vous ne peut pas être modifié.'], 400);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Annulation d'un rendez-vous par le patient.
     */
    public function cancelAppointment(Request $request, int $id): JsonResponse
    {
        $reason = $request->input('reason', 'Annulé par le patient');

        DB::beginTransaction();

        try {
            $appointment = Appointment::with(['patient', 'slot.doctor', 'payments'])->find($id);

            if (!$appointment) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Rendez-vous introuvable.'], 404);
            }

            if (in_array($appointment->status, ['ANNULE_PATIENT', 'ANNULE_HOPITAL', 'EXPIRE'])) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Rendez-vous déjà annulé ou expiré.'], 400);
            }

            // Libération conditionnelle du créneau selon la date/heure
            if ($appointment->slot) {
                $this->releaseSlot($appointment->slot);
            }

            // CAS 1 : Non payé -> Annulation directe sans remboursement
            if (in_array($appointment->status, ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_VALIDATION'])) {
                $appointment->update([
                    'status' => 'ANNULE_PATIENT',
                    'cancellation_reason' => $reason
                ]);

                DB::commit();

                // 📩 ENVOI EMAIL : Annulation par le patient
                Mail::to($appointment->patient->email)->queue(new AppointmentCancelledMail($appointment));

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

                    // 📩 ENVOI EMAIL : Annulation par le patient
                    Mail::to($appointment->patient->email)->queue(new AppointmentCancelledMail($appointment));

                    return response()->json([
                        'success' => true,
                        'message' => 'Rendez-vous annulé. Aucun remboursement n\'est appliqué le jour même.'
                    ], 200);
                }

                // Remboursement via FedaPay
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

                // 📩 ENVOI EMAIL : Annulation par le patient
                Mail::to($appointment->patient->email)->queue(new AppointmentCancelledMail($appointment));

                return response()->json([
                    'success' => true,
                    'message' => 'Rendez-vous annulé et remboursement à 100% initié.'
                ], 200);
            }

            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Statut non annulable.'], 400);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère les données du profil patient.
     */
    public function getProfile($keycloakUuid): JsonResponse
    {
        try {
            $user = User::where('keycloak_uuid', $keycloakUuid)->first();

            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Profil non trouvé.'], 404);
            }

            return response()->json(['success' => true, 'data' => $user], 200);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Mise à jour du profil du patient.
     */
    public function updateProfile(Request $request, $keycloakUuid): JsonResponse
    {
        try {
            $user = User::firstOrCreate(
                ['keycloak_uuid' => $keycloakUuid],
                ['role' => 'patient']
            );

            $validated = $request->validate([
                'nom' => 'required|string|max:255',
                'prenom' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email,' . $user->id,
                'telephone' => 'nullable|string|max:50',
                'age' => 'nullable|integer|min:0|max:120',
                'sexe' => 'nullable|in:M,F',
            ]);

            $user->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Profil mis à jour avec succès.',
                'data' => $user
            ], 200);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Récupère les jours ayant au moins un créneau disponible et futur pour un médecin.
     */
    public function getAvailableDays(Doctor $doctor): JsonResponse
    {
        try {
            $now = Carbon::now();

            $days = $doctor->slots()
                ->where('status', 'Disponible')
                ->where(function ($query) use ($now) {
                    $query->where('date_consultation', '>', $now->toDateString())
                        ->orWhere(function ($sub) use ($now) {
                            $sub->where('date_consultation', '=', $now->toDateString())
                                ->where('start_time', '>', $now->toTimeString());
                        });
                })
                ->orderBy('date_consultation', 'asc')
                ->pluck('date_consultation')
                ->unique()
                ->values();

            return response()->json(['success' => true, 'data' => $days], 200);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Helper réutilisable pour libérer un créneau en vérifiant si la date/heure est passée.
     */
    private function releaseSlot(Slot $slot): void
    {
        $slotStart = Carbon::parse("{$slot->date_consultation} {$slot->start_time}");
        $isFuture = $slotStart->isFuture();

        $slot->update([
            'status' => $isFuture ? 'Disponible' : 'Indisponible',
            'is_available' => $isFuture,
            'reserved_until' => null,
        ]);
    }
}

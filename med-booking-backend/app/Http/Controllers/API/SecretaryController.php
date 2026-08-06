<?php

namespace App\Http\Controllers\API;

use Carbon\Carbon;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\DoctorAvailability;
use App\Models\DoctorUnavailability;
use App\Models\Slot;
use App\Services\SlotGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\AppointmentCancelledMail;
use App\Mail\AppointmentRefusedMail;
use App\Mail\InsuranceValidatedMail;

class SecretaryController extends Controller
{
    /**
     * 1. Liste de tous les rendez-vous.
     */
    public function index(): JsonResponse
    {
        try {
            // Ajout de 'slot.doctor' pour récupérer le nom/prénom du médecin
            $appointments = Appointment::with(['patient', 'slot.doctor', 'slot.doctor.speciality'])
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
     * 2. Validation / Acceptation de l'assurance.
     */
    public function validateInsurance(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'insurance_coverage_rate' => 'required|integer|min:0|max:100',
        ]);

        DB::beginTransaction();
        try {
            // Chargement explicite du patient et des relations du slot pour le mail
            $appointment = Appointment::with(['patient', 'slot.doctor', 'slot.doctor.speciality'])
                ->findOrFail($request->input('appointment_id'));

            $coverageRate = (int) $request->input('insurance_coverage_rate');
            $basePrice = $appointment->base_price;
            $amountToPay = $basePrice * ((100 - $coverageRate) / 100);

            // Si couverture 100%, pas besoin de paiement -> Statut CONFIRME direct
            $newStatus = ($coverageRate === 100) ? 'CONFIRME' : 'EN_ATTENTE_PAIEMENT';

            $appointment->update([
                'insurance_coverage_rate' => $coverageRate,
                'amount_to_pay'           => $amountToPay,
                'status'                  => $newStatus,
                'cancellation_reason'     => null,
            ]);

            if ($newStatus === 'CONFIRME' && $appointment->slot) {
                $appointment->slot->update([
                    'status' => 'Occupé',
                    'reserved_until' => null,
                ]);
            }

            DB::commit();

            // 📩 ENVOI EMAIL : Assurance validée
            Mail::to($appointment->patient->email)->queue(new InsuranceValidatedMail($appointment));

            return response()->json([
                'success' => true,
                'message' => $coverageRate === 100
                    ? 'Assurance à 100% validée. Rendez-vous confirmé !'
                    : 'Assurance validée ! Reste à payer calculé.',
                'data' => $appointment
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 3. Refus de l'assurance.
     */
    public function rejectInsurance(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'reason'         => 'required|string|max:255',
        ]);

        try {
            // Chargement de la relation 'patient' pour l'envoi du mail
            $appointment = Appointment::with(['patient', 'slot.doctor'])
                ->findOrFail($request->input('appointment_id'));

            $appointment->update([
                'insurance_coverage_rate' => 0,
                'amount_to_pay'           => $appointment->base_price,
                'status'                  => 'EN_ATTENTE_PAIEMENT',
                'cancellation_reason'     => 'Assurance refusée : ' . $request->input('reason'),
            ]);

            // ENVOI EMAIL : Assurance refusée
            Mail::to($appointment->patient->email)->queue(new AppointmentRefusedMail($appointment));

            return response()->json([
                'success' => true,
                'message' => 'Assurance refusée. Le patient doit régler la totalité.',
                'data' => $appointment
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 4. Mise à jour du statut final du RDV (TERMINE, ABSENT, etc.).
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|string|in:CONFIRME,TERMINE,ABSENT,ANNULE_PATIENT,ANNULE_HOPITAL'
        ]);

        try {
            // Chargement de l'appointment avec son slot
            $appointment = Appointment::with('slot')->findOrFail($id);
            $newStatus = $request->input('status');

            // Vérification temporelle pour les statuts TERMINE et ABSENT
            if (in_array($newStatus, ['TERMINE', 'ABSENT'])) {
                if (!$appointment->slot) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Impossible d\'évaluer la date : créneau associé introuvable.'
                    ], 400);
                }

                // Reconstruction de la date et de l'heure de début du créneau
                $slotStartDatetime = Carbon::parse(
                    $appointment->slot->date_consultation . ' ' . $appointment->slot->start_time
                );

                // Si la date actuelle est antérieure au début du rendez-vous
                if (now()->lt($slotStartDatetime)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Le rendez-vous n\'a pas encore eu lieu. Vous ne pouvez pas le marquer comme ' . strtolower($newStatus) . '.'
                    ], 400);
                }
            }

            $appointment->update(['status' => $newStatus]);

            return response()->json([
                'success' => true,
                'message' => 'Statut mis à jour avec succès.',
                'data' => $appointment
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 5. Liste de tous les médecin avec leur spécialité.
     */
    public function getDoctors(): JsonResponse
    {
        try {
            $doctors = Doctor::with(['speciality'])->get();
            return response()->json(['success' => true, 'data' => $doctors], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 6. Obtenir l'historique des indisponibilités d'un médecin.
     */
    public function getDoctorUnavailabilities(int $doctorId): JsonResponse
    {
        try {
            $unavailabilities = DoctorUnavailability::where('doctor_id', $doctorId)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json(['success' => true, 'data' => $unavailabilities], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 7. Bloquer une journée entière ou une sélection de créneaux.
     */
    public function blockSlotsOrDay(Request $request): JsonResponse
    {
        $request->validate([
            'doctor_id'  => 'required|exists:doctors,id',
            'date'       => 'required|date',
            'type'       => 'nullable|string|in:CONGE,MALADIE,URGENCE,FORMATION,AUTRE',
            'reason'     => 'nullable|string|max:255',
            'slot_ids'   => 'nullable|array',
            'slot_ids.*' => 'exists:slots,id'
        ]);

        try {
            return DB::transaction(function () use ($request) {
                $isFullDay = empty($request->input('slot_ids'));
                $doctorId  = $request->input('doctor_id');
                $date      = $request->input('date');

                if ($isFullDay) {
                    $startDatetime = "{$date} 00:00:00";
                    $endDatetime   = "{$date} 23:59:59";

                    $slotsToBlock = Slot::where('doctor_id', $doctorId)
                        ->where('date_consultation', $date)
                        ->get();
                } else {
                    $slotsToBlock = Slot::whereIn('id', $request->input('slot_ids'))->get();

                    if ($slotsToBlock->isEmpty()) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Aucun créneau valide sélectionné.'
                        ], 400);
                    }

                    $minTime = $slotsToBlock->min('start_time');
                    $maxTime = $slotsToBlock->max('end_time');

                    $startDatetime = "{$date} {$minTime}";
                    // Carbon gère proprement le format et l'ajout de la seconde
                    $endDatetime   = Carbon::parse("{$date} {$maxTime}")->addSecond()->toDateTimeString();
                }

                // Gestion propre de l'auteur de l'action
                $createdBy = auth()->id() ?? \App\Models\User::first()?->id ?? 1;

                // 1. Création du registre d'indisponibilité
                $unavailability = DoctorUnavailability::create([
                    'doctor_id'      => $doctorId,
                    'start_datetime' => $startDatetime,
                    'end_datetime'   => $endDatetime,
                    'is_full_day'    => $isFullDay,
                    'type'           => $request->input('type', 'URGENCE'),
                    'reason'         => $request->input('reason', 'Indisponibilité déclarée'),
                    'status'         => 'ACTIF',
                    'created_by'     => $createdBy,
                ]);

                if ($slotsToBlock->isNotEmpty()) {
                    $slotIds = $slotsToBlock->pluck('id');

                    // 2. Marquer les créneaux comme indisponibles
                    Slot::whereIn('id', $slotIds)->update([
                        'status'       => 'Indisponible',
                    ]);

                    // 3. Traitement des rendez-vous déjà réservés sur ces créneaux
                    $impactedAppointments = Appointment::with(['patient', 'slot.doctor'])
                        ->whereIn('slot_id', $slotIds)
                        ->whereNotIn('status', ['ANNULE_PATIENT', 'ANNULE_HOPITAL', 'TERMINE'])
                        ->get();

                    if ($impactedAppointments->isNotEmpty()) {
                        Appointment::whereIn('id', $impactedAppointments->pluck('id'))
                            ->update([
                                'status'              => 'ANNULE_HOPITAL',
                                'cancellation_reason' => $request->input('reason', 'Absence / Urgence médicale')
                            ]);

                        // Notification e-mail après commit de la transaction
                        DB::afterCommit(function () use ($impactedAppointments) {
                            foreach ($impactedAppointments as $appointment) {
                                if ($appointment->patient?->email) {
                                    Mail::to($appointment->patient->email)
                                        ->queue(new AppointmentCancelledMail($appointment));
                                }
                            }
                        });
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Blocage effectué avec succès.',
                    'data'    => $unavailability
                ], 200);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du blocage : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 8. Débloquer une indisponibilité (Levée).
     */
    public function unblockAvailability(int $unavailabilityId): JsonResponse
    {
        try {
            return DB::transaction(function () use ($unavailabilityId) {
                $unavailability = DoctorUnavailability::findOrFail($unavailabilityId);

                if ($unavailability->status !== 'ACTIF') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cette indisponibilité est déjà annulée ou inactive.'
                    ], 400);
                }

                // 1. Marquer l'indisponibilité comme annulée
                $unavailability->update([
                    'status'       => 'ANNULE',
                    'cancelled_by' => auth()->id() ?? \App\Models\User::first()?->id ?? 1,
                    'cancelled_at' => now(),
                ]);

                // 2. Extraire la plage exacte à débloquer
                $startDate = Carbon::parse($unavailability->start_datetime)->toDateString();
                $endDate   = Carbon::parse($unavailability->end_datetime)->toDateString();
                $startTime = Carbon::parse($unavailability->start_datetime)->toTimeString();
                $endTime   = Carbon::parse($unavailability->end_datetime)->toTimeString();

                // 3. Débloquer UNIQUEMENT les créneaux de cet intervalle
                $query = Slot::where('doctor_id', $unavailability->doctor_id)
                    ->whereBetween('date_consultation', [$startDate, $endDate])
                    ->where('status', 'Indisponible');

                if (!$unavailability->is_full_day) {
                    $query->where('start_time', '>=', $startTime)
                        ->where('end_time', '<=', $endTime);
                }

                $query->update([
                    'status'       => 'Disponible',
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Créneaux débloqués et de nouveau disponibles.'
                ], 200);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du déblocage : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 9. Obtenir les règles de disponibilité hebdomadaire d'un médecin.
     */
    public function getDoctorAvailabilities(int $id): JsonResponse
    {
        try {
            $availabilities = DoctorAvailability::where('doctor_id', $id)
                ->orderBy('day_of_week')
                ->orderBy('start_time')
                ->get();

            return response()->json(['success' => true, 'data' => $availabilities], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 10. Sauvegarder les règles de disponibilité récurrente pour un médecin.
     */
    public function setDoctorAvailabilities(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'availabilities' => 'required|array',
            'availabilities.*.day_of_week' => 'required|integer|between:1,7',
            'availabilities.*.start_time'  => 'required|string',
            'availabilities.*.end_time'    => 'required|string',
        ]);

        try {
            DB::transaction(function () use ($request, $id) {
                DoctorAvailability::where('doctor_id', $id)->delete();

                foreach ($request->input('availabilities') as $item) {
                    DoctorAvailability::create([
                        'doctor_id'   => $id,
                        'day_of_week' => $item['day_of_week'],
                        'start_time'  => $item['start_time'],
                        'end_time'    => $item['end_time'],
                    ]);
                }
            });

            return response()->json([
                'success' => true,
                'message' => 'Disponibilités récurrentes enregistrées avec succès.'
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 11. Déclencher la génération de créneaux sur une période.
     */
    public function generateDoctorSlots(Request $request, SlotGeneratorService $generatorService): JsonResponse
    {
        $request->validate([
            'doctor_id'  => 'required|exists:doctors,id',
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
        ]);

        try {
            $count = $generatorService->generateForDoctor(
                (int) $request->input('doctor_id'),
                $request->input('start_date'),
                $request->input('end_date')
            );

            return response()->json([
                'success' => true,
                'message' => "{$count} créneau(x) généré(s) avec succès pour ce médecin.",
                'data'    => ['slots_created' => $count]
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}

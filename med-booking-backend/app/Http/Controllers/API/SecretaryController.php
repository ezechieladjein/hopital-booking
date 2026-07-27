<?php

namespace App\Http\Controllers\API;

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
                    'is_available' => false,
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

            // 📩 ENVOI EMAIL : Assurance refusée
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
            $appointment = Appointment::findOrFail($id);
            $appointment->update(['status' => $request->input('status')]);

            return response()->json([
                'success' => true,
                'message' => 'Statut mis à jour.',
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
            $doctors = Doctor::with(['user', 'speciality'])->get();
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
            'type'       => 'nullable|string',
            'reason'     => 'nullable|string',
            'slot_ids'   => 'nullable|array',
            'slot_ids.*' => 'exists:slots,id'
        ]);

        try {
            return DB::transaction(function () use ($request) {
                $isFullDay = empty($request->input('slot_ids'));
                $doctorId = $request->input('doctor_id');
                $date = $request->input('date');

                if ($isFullDay) {
                    $startDatetime = "{$date} 00:00:00";
                    $endDatetime = "{$date} 23:59:59";
                    $slotsToBlock = Slot::where('doctor_id', $doctorId)
                        ->where('date_consultation', $date)
                        ->get();
                } else {
                    $slotsToBlock = Slot::whereIn('id', $request->input('slot_ids'))->get();
                    $startDatetime = "{$date} " . $slotsToBlock->min('start_time');
                    $endDatetime = "{$date} " . $slotsToBlock->max('end_time');
                }

                if ($slotsToBlock->isEmpty()) {
                    return response()->json(['success' => false, 'message' => 'Aucun créneau trouvé pour cette opération.'], 400);
                }

                DoctorUnavailability::create([
                    'doctor_id'      => $doctorId,
                    'start_datetime' => $startDatetime,
                    'end_datetime'   => $endDatetime,
                    'is_full_day'    => $isFullDay,
                    'type'           => $request->input('type', 'URGENCE'),
                    'reason'         => $request->input('reason', 'Indisponibilité / Urgence'),
                    'status'         => 'ACTIF',
                    'created_by'     => auth()->id() ?? 1,
                ]);

                $slotIds = $slotsToBlock->pluck('id');

                Slot::whereIn('id', $slotIds)->update([
                    'status' => 'Indisponible',
                    'is_available' => false,
                ]);

                // 📩 1. RÉCUPÉRATION DES RDV ET PATIENTS IMPACTÉS (Avec relations complètes)
                $impactedAppointments = Appointment::with(['patient', 'slot.doctor', 'slot.doctor.speciality'])
                    ->whereIn('slot_id', $slotIds)
                    ->whereNotIn('status', ['ANNULE_PATIENT', 'ANNULE_HOPITAL', 'TERMINE'])
                    ->get();

                // 2. Mise à jour du statut des rendez-vous en base de données
                Appointment::whereIn('id', $impactedAppointments->pluck('id'))
                    ->update([
                        'status' => 'ANNULE_HOPITAL',
                        'cancellation_reason' => 'Absence / Urgence médicale'
                    ]);

                // 📩 3. ENVOI DES E-MAILS AUX PATIENTS
                foreach ($impactedAppointments as $appointment) {
                    if ($appointment->patient && $appointment->patient->email) {
                        Mail::to($appointment->patient->email)
                            ->queue(new AppointmentCancelledMail($appointment));
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Indisponibilité enregistrée et créneaux bloqués avec succès.'
                ], 200);
            });
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 8. Débloquer une indisponibilité (Levée).
     */
    public function unblockAvailability(int $id): JsonResponse
    {
        try {
            return DB::transaction(function () use ($id) {
                $unavailability = DoctorUnavailability::findOrFail($id);

                $unavailability->update([
                    'status'       => 'ANNULE',
                    'cancelled_by' => auth()->id() ?? 1,
                    'cancelled_at' => now(),
                ]);

                $startDate = substr($unavailability->start_datetime, 0, 10);
                $endDate = substr($unavailability->end_datetime, 0, 10);

                Slot::where('doctor_id', $unavailability->doctor_id)
                    ->whereBetween('date_consultation', [$startDate, $endDate])
                    ->where('status', 'Indisponible')
                    ->update([
                        'status' => 'Disponible',
                        'is_available' => true,
                    ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Indisponibilité levée et créneaux débloqués.'
                ], 200);
            });
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
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
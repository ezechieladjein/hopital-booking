<?php

namespace App\Http\Controllers\API;

use Carbon\Carbon;
use App\Http\Controllers\Controller;
use FedaPay\FedaPay;
use FedaPay\Transaction;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\DoctorAvailability;
use App\Models\DoctorUnavailability;
use App\Models\Notification;
use App\Models\Slot;
use App\Models\User;
use App\Models\Payment;
use App\Models\Speciality;
use App\Services\SlotGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\AppointmentCreatedMail;
use App\Mail\AppointmentUpdatedMail;
use App\Mail\AppointmentCancelledMail;
use App\Mail\AppointmentRefusedMail;
use App\Mail\InsuranceValidatedMail;
use App\Mail\PaymentLinkMail;

class SecretaryController extends Controller
{
    /**
     * 1. Liste de tous les rendez-vous.
     */
    public function index(): JsonResponse
    {
        try {
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
     * Récupérer la liste complète des patients
     */
    public function getPatientsList(): JsonResponse
    {
        try {
            $patients = User::where('role', 'patient')
                ->orderBy('nom')
                ->orderBy('prenom')
                ->get(['id', 'nom', 'prenom', 'telephone', 'email', 'sexe', 'age', 'created_at']);

            return response()->json([
                'success' => true,
                'data' => $patients
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
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
            $appointment = Appointment::with(['patient', 'slot.doctor', 'slot.doctor.speciality'])
                ->findOrFail($request->input('appointment_id'));

            $coverageRate = (int) $request->input('insurance_coverage_rate');
            $basePrice = $appointment->base_price;
            $amountToPay = $basePrice * ((100 - $coverageRate) / 100);

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
            $appointment = Appointment::with(['patient', 'slot.doctor'])
                ->findOrFail($request->input('appointment_id'));

            $appointment->update([
                'insurance_coverage_rate' => 0,
                'amount_to_pay'           => $appointment->base_price,
                'status'                  => 'EN_ATTENTE_PAIEMENT',
                'cancellation_reason'     => 'Assurance refusée : ' . $request->input('reason'),
            ]);

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
            $appointment = Appointment::with('slot')->findOrFail($id);
            $newStatus = $request->input('status');

            if (in_array($newStatus, ['TERMINE', 'ABSENT'])) {
                if (!$appointment->slot) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Impossible d\'évaluer la date : créneau associé introuvable.'
                    ], 400);
                }

                $slotStartDatetime = Carbon::parse(
                    $appointment->slot->date_consultation . ' ' . $appointment->slot->start_time
                );

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
                    $slotsToBlock  = Slot::where('doctor_id', $doctorId)
                        ->where('date_consultation', $date)
                        ->get();
                } else {
                    $slotsToBlock = Slot::whereIn('id', $request->input('slot_ids'))->get();
                    if ($slotsToBlock->isEmpty()) {
                        return response()->json(['success' => false, 'message' => 'Aucun créneau valide sélectionné.'], 400);
                    }
                    $minTime = $slotsToBlock->min('start_time');
                    $maxTime = $slotsToBlock->max('end_time');
                    $startDatetime = "{$date} {$minTime}";
                    $endDatetime   = Carbon::parse("{$date} {$maxTime}")->addSecond()->toDateTimeString();
                }

                $createdBy = auth()->id() ?? \App\Models\User::first()?->id ?? 1;

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

                    Slot::whereIn('id', $slotIds)->update(['status' => 'Indisponible']);

                    $impactedAppointments = Appointment::with(['patient', 'slot.doctor', 'payments'])
                        ->whereIn('slot_id', $slotIds)
                        ->whereNotIn('status', ['ANNULE_PATIENT', 'ANNULE_HOPITAL', 'TERMINE'])
                        ->get();

                    foreach ($impactedAppointments as $appointment) {
                        $cancellationReason = $request->input('reason', 'Absence / Urgence médicale du médecin');

                        if ($appointment->status === 'CONFIRME') {
                            $approvedPayment = $appointment->payments()->where('status', 'approved')->first();
                            if ($approvedPayment) {
                                try {
                                    FedaPay::setApiKey(config('services.fedapay.secret'));
                                    FedaPay::setEnvironment(config('services.fedapay.environment', 'sandbox'));

                                    $transaction = Transaction::retrieve($approvedPayment->fedapay_transaction_id);
                                    $transaction->refund();

                                    $approvedPayment->update([
                                        'status' => 'refunded',
                                        'refunded_amount' => $approvedPayment->amount_paid
                                    ]);

                                    $cancellationReason .= ' (Remboursement FedaPay effectué)';
                                } catch (\Exception $e) {
                                    Log::error("Erreur remboursement FedaPay RDV #{$appointment->id}: " . $e->getMessage());
                                    $cancellationReason .= ' (Échec du remboursement automatique FedaPay)';
                                }
                            }
                        }

                        $appointment->update([
                            'status' => 'ANNULE_HOPITAL',
                            'cancellation_reason' => $cancellationReason
                        ]);

                        if ($appointment->patient?->keycloak_uuid) {
                            Notification::create([
                                'user_uuid' => $appointment->patient->keycloak_uuid,
                                'title' => 'Rendez-vous Annulé par l\'Hôpital',
                                'message' => "Votre RDV du {$appointment->slot->date_consultation} a été annulé pour cause d'absence du médecin. " .
                                    ($appointment->status === 'CONFIRME' ? "Un remboursement a été initié." : ""),
                                'type' => 'alert',
                                'read' => false
                            ]);
                        }
                    }

                    DB::afterCommit(function () use ($impactedAppointments) {
                        foreach ($impactedAppointments as $appointment) {
                            if ($appointment->patient?->email) {
                                Mail::to($appointment->patient->email)->queue(new AppointmentCancelledMail($appointment));
                            }
                        }
                    });
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Blocage effectué, remboursements traités et notifications envoyées.',
                    'data'    => $unavailability
                ], 200);
            });
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur lors du blocage : ' . $e->getMessage()], 500);
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

                $unavailability->update([
                    'status'       => 'ANNULE',
                    'cancelled_by' => auth()->id() ?? \App\Models\User::first()?->id ?? 1,
                    'cancelled_at' => now(),
                ]);

                $startDate = Carbon::parse($unavailability->start_datetime)->toDateString();
                $endDate   = Carbon::parse($unavailability->end_datetime)->toDateString();
                $startTime = Carbon::parse($unavailability->start_datetime)->toTimeString();
                $endTime   = Carbon::parse($unavailability->end_datetime)->toTimeString();

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

    /**
     * 12. Recherche ou Création Rapide d'un Patient (Présentiel / Appel).
     */
    public function findOrCreatePatient(Request $request): JsonResponse
    {
        $request->validate([
            'telephone' => 'required|string|max:50',
            'nom'       => 'required|string|max255',
            'prenom'    => 'required|string|max:255',
            'email'     => 'nullable|email|max:255',
            'sexe'      => 'nullable|in:M,F',
            'age'       => 'nullable|integer|min:0|max:120',
        ]);

        try {
            $telephone = $request->input('telephone');
            $email = $request->input('email');

            $user = User::where('telephone', $telephone)->first();

            if (!$user && $email) {
                $user = User::where('email', $email)->first();
            }

            if ($user) {
                $user->update(array_filter([
                    'nom'       => $request->input('nom'),
                    'prenom'    => $request->input('prenom'),
                    'email'     => $email ?: $user->email,
                    'telephone' => $telephone,
                    'sexe'      => $request->input('sexe') ?: $user->sexe,
                    'age'       => $request->input('age') ?: $user->age,
                ]));
            } else {
                $user = User::create([
                    'keycloak_uuid' => 'sec-patient-' . uniqid(),
                    'nom'           => $request->input('nom'),
                    'prenom'        => $request->input('prenom'),
                    'email'         => $email ?: 'patient-' . time() . '@hopital.local',
                    'telephone'     => $telephone,
                    'sexe'          => $request->input('sexe'),
                    'age'           => $request->input('age'),
                    'role'          => 'patient',
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Patient identifié avec succès.',
                'data'    => $user
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 13. Prise de rendez-vous assistée par la Secrétaire + Paiement FedaPay optionnel.
     */
    public function createAssistedAppointment(Request $request): JsonResponse
    {
        $request->validate([
            'patient_id'              => 'required|exists:users,id',
            'slot_id'                 => 'required|exists:slots,id',
            'has_insurance'           => 'nullable|boolean',
            'insurance_name'          => 'nullable|string|max:255',
            'insurance_policy_number' => 'nullable|string|max:255',
            'insurance_coverage_rate' => 'nullable|integer|min:0|max:100',
        ]);

        DB::beginTransaction();
        try {
            $patient = User::findOrFail($request->input('patient_id'));
            $slot = Slot::lockForUpdate()->with('doctor.speciality')->findOrFail($request->input('slot_id'));

            if ($slot->status !== 'Disponible') {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Ce créneau n\'est plus disponible.'
                ], 422);
            }

            $hasInsurance = filter_var($request->input('has_insurance'), FILTER_VALIDATE_BOOLEAN);
            $coverageRate = $hasInsurance ? ((int) $request->input('insurance_coverage_rate', 0)) : 0;
            $basePrice = $slot->doctor->speciality->tarif ?? 25000;
            $amountToPay = (int) ($basePrice * ((100 - $coverageRate) / 100));

            $documentPath = null;

            $initialStatus = 'EN_ATTENTE_PAIEMENT';
            if ($hasInsurance && $coverageRate === 0) {
                $initialStatus = 'EN_ATTENTE_VALIDATION';
            } elseif ($amountToPay === 0) {
                $initialStatus = 'CONFIRME';
            }

            // 🔴 CORRECTION : Récupérer l'utilisateur depuis le middleware
            $secretary = $request->user() ?? $request->attributes->get('user');
            $secretaryId = $secretary ? $secretary->id : null;

            // Fallback : récupérer via l'email du token Keycloak
            if (!$secretaryId) {
                $keycloakUser = $request->attributes->get('keycloak_user');
                if ($keycloakUser && isset($keycloakUser['email'])) {
                    $user = User::where('email', $keycloakUser['email'])->first();
                    if ($user) {
                        $secretaryId = $user->id;
                    }
                }
            }

            // Dernier fallback : récupérer le premier secrétaire
            if (!$secretaryId) {
                $secretaryId = User::where('role', 'secretaire')->orWhere('role', 'secretary')->first()?->id ?? 1;
            }

            $appointment = Appointment::create([
                'patient_id'              => $patient->id,
                'slot_id'                 => $slot->id,
                'status'                  => $initialStatus,
                'has_insurance'           => $hasInsurance ? 1 : 0,
                'insurance_name'          => $hasInsurance ? $request->input('insurance_name') : null,
                'insurance_policy_number' => $hasInsurance ? $request->input('insurance_policy_number') : null,
                'insurance_document_path' => $documentPath,
                'insurance_coverage_rate' => $coverageRate,
                'base_price'              => $basePrice,
                'amount_to_pay'           => $amountToPay,
                'created_by'              => $secretaryId,
            ]);

            $slot->update([
                'status'         => $initialStatus === 'CONFIRME' ? 'Occupé' : 'Réservé temporairement',
                'is_available'   => false,
                'reserved_until' => $initialStatus === 'CONFIRME' ? null : Carbon::now()->addHours(24),
            ]);

            DB::commit();

            if ($patient->email && filter_var($patient->email, FILTER_VALIDATE_EMAIL)) {
                Mail::to($patient->email)->queue(new AppointmentCreatedMail($appointment));
            }

            return response()->json([
                'success' => true,
                'message' => 'Rendez-vous créé avec succès.',
                'data'    => [
                    'appointment' => $appointment->load(['patient', 'slot.doctor.speciality']),
                    'amount_to_pay' => $amountToPay,
                    'appointment_id' => $appointment->id,
                    'status' => $initialStatus,
                    'created_by' => $secretaryId,
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 13b. Initier un paiement FedaPay pour un rendez-vous créé par le secrétariat.
     * POST /api/secretary/payments/initiate
     */
    public function initiateSecretaryPayment(Request $request): JsonResponse
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

            // Créer la transaction sur FedaPay
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

            Payment::create([
                'appointment_id' => $appointment->id,
                'fedapay_transaction_id' => $transaction->id,
                'payment_method' => 'mobile_money',
                'amount_paid' => (int) $appointment->amount_to_pay,
                'status' => 'pending',
            ]);

            $token = $transaction->generateToken();

            // Envoyer l'email avec le lien de paiement
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
     * 14. Modification assistée d'un rendez-vous sous demande du patient.
     */
    public function rescheduleAssistedAppointment(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'slot_id'                 => 'required|exists:slots,id',
        ]);

        DB::beginTransaction();
        try {
            $appointment = Appointment::with(['patient', 'slot.doctor.speciality'])->findOrFail($id);

            $forbiddenStatuses = ['TERMINE', 'ABSENT', 'ANNULE_PATIENT', 'ANNULE_HOPITAL', 'EXPIRE'];
            if (in_array($appointment->status, $forbiddenStatuses)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Ce rendez-vous ne peut plus être modifié (statut : ' . $appointment->status . ').'
                ], 422);
            }

            $newSlot = Slot::lockForUpdate()->with('doctor.speciality')->findOrFail($request->input('slot_id'));

            if ($newSlot->id !== $appointment->slot_id && $newSlot->status !== 'Disponible') {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Le nouveau créneau n\'est pas disponible.'], 422);
            }

            if ($appointment->slot && $appointment->slot_id !== $newSlot->id) {
                $slotStart = Carbon::parse("{$appointment->slot->date_consultation} {$appointment->slot->start_time}");
                $isFuture = $slotStart->isFuture();
                $appointment->slot->update([
                    'status'         => $isFuture ? 'Disponible' : 'Indisponible',
                    'is_available'   => $isFuture,
                    'reserved_until' => null,
                ]);
            }

            $isConfirmed = $appointment->status === 'CONFIRME';
            $newSlot->update([
                'status'         => $isConfirmed ? 'Occupé' : 'Réservé temporairement',
                'is_available'   => false,
                'reserved_until' => $isConfirmed ? null : Carbon::now()->addHours(24),
            ]);

            $hasInsurance = filter_var($appointment->has_insurance, FILTER_VALIDATE_BOOLEAN);
            $newBasePrice = $newSlot->doctor->speciality->tarif ?? $appointment->base_price;
            $coverageRate = $appointment->insurance_coverage_rate ?? 0;
            $newAmountToPay = (int) ($newBasePrice * ((100 - $coverageRate) / 100));

            $appointment->update([
                'slot_id'                 => $newSlot->id,
                'base_price'              => $newBasePrice,
                'amount_to_pay'           => $newAmountToPay,
            ]);

            DB::commit();

            if ($appointment->patient?->email) {
                Mail::to($appointment->patient->email)->queue(new AppointmentUpdatedMail($appointment));
            }

            return response()->json([
                'success' => true,
                'message' => 'Rendez-vous réorganisé avec succès.',
                'data'    => $appointment->load(['patient', 'slot.doctor.speciality'])
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 15. Annulation d'un rendez-vous à la demande du patient avec remboursement optionnel.
     */
    public function cancelAssistedAppointment(Request $request, int $id): JsonResponse
    {
        $reason = $request->input('reason', 'Annulé en guichet / par téléphone');

        DB::beginTransaction();
        try {
            $appointment = Appointment::with(['patient', 'slot', 'payments'])->findOrFail($id);

            $nonCancellableStatuses = ['TERMINE', 'ABSENT', 'ANNULE_PATIENT', 'ANNULE_HOPITAL', 'EXPIRE'];
            if (in_array($appointment->status, $nonCancellableStatuses)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Ce rendez-vous ne peut plus être annulé.'
                ], 422);
            }

            if ($appointment->slot) {
                $slotStart = Carbon::parse("{$appointment->slot->date_consultation} {$appointment->slot->start_time}");
                $isFuture = $slotStart->isFuture();
                $appointment->slot->update([
                    'status'         => $isFuture ? 'Disponible' : 'Indisponible',
                    'is_available'   => $isFuture,
                    'reserved_until' => null,
                ]);
            }

            if ($appointment->status === 'CONFIRME') {
                $approvedPayment = $appointment->payments()->where('status', 'approved')->first();
                if ($approvedPayment) {
                    try {
                        FedaPay::setApiKey(config('services.fedapay.secret'));
                        FedaPay::setEnvironment(config('services.fedapay.environment', 'sandbox'));

                        $transaction = Transaction::retrieve($approvedPayment->fedapay_transaction_id);
                        $transaction->refund();

                        $approvedPayment->update([
                            'status'          => 'refunded',
                            'refunded_amount' => $approvedPayment->amount_paid,
                        ]);
                        $reason .= ' (Remboursement FedaPay effectué)';
                    } catch (\Exception $e) {
                        Log::error("Échec remboursement RDV #{$appointment->id}: " . $e->getMessage());
                    }
                }
            }

            $appointment->update([
                'status'              => 'ANNULE_PATIENT',
                'cancellation_reason' => $reason,
            ]);

            DB::commit();

            if ($appointment->patient?->email) {
                Mail::to($appointment->patient->email)->queue(new AppointmentCancelledMail($appointment));
            }

            return response()->json([
                'success' => true,
                'message' => 'Rendez-vous annulé avec succès.',
                'data'    => $appointment
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 16. Historique des rendez-vous saisis par le secrétariat.
     */
    public function getSecretaryBookingHistory(): JsonResponse
    {
        try {
            // 🔴 CORRECTION : Récupérer l'utilisateur depuis le middleware
            $secretary = request()->user() ?? request()->attributes->get('user');
            $secretaryId = $secretary ? $secretary->id : null;

            // Fallback : récupérer via l'email du token Keycloak
            if (!$secretaryId) {
                $keycloakUser = request()->attributes->get('keycloak_user');
                if ($keycloakUser && isset($keycloakUser['email'])) {
                    $user = User::where('email', $keycloakUser['email'])->first();
                    if ($user) {
                        $secretaryId = $user->id;
                    }
                }
            }

            // Dernier fallback : récupérer le premier secrétaire
            if (!$secretaryId) {
                $secretaryId = User::where('role', 'secretaire')->orWhere('role', 'secretary')->first()?->id ?? 1;
            }

            $appointments = Appointment::with(['patient', 'slot.doctor.speciality', 'payments'])
                ->where('created_by', $secretaryId)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data'    => $appointments
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper interne : Déclenchement d'une transaction FedaPay sur le téléphone du patient.
     */
    private function processDirectFedaPayPayment(Appointment $appointment, string $phoneNumber, string $mode): array
    {
        try {
            FedaPay::setApiKey(config('services.fedapay.secret'));
            FedaPay::setEnvironment(config('services.fedapay.environment', 'sandbox'));

            $transaction = Transaction::create([
                'description' => "Paiement RDV Medical #{$appointment->id}",
                'amount'      => $appointment->amount_to_pay,
                'currency'    => ['iso' => 'XOF'],
                'callback_url' => route('payments.webhook'),
                'customer'    => [
                    'firstname'    => $appointment->patient->prenom,
                    'lastname'     => $appointment->patient->nom,
                    'email'        => $appointment->patient->email,
                    'phone_number' => [
                        'number'  => $phoneNumber,
                        'country' => 'bj',
                    ]
                ]
            ]);

            $token = $transaction->generateToken();

            Payment::create([
                'appointment_id'         => $appointment->id,
                'fedapay_transaction_id' => $transaction->id,
                'reference'              => 'SEC-' . time() . '-' . $appointment->id,
                'amount'                 => $appointment->amount_to_pay,
                'status'                 => 'pending',
                'payment_method'         => $mode,
            ]);

            return [
                'transaction_id' => $transaction->id,
                'payment_url'    => $token->url,
                'status'         => 'pending',
            ];
        } catch (\Exception $e) {
            Log::error("Erreur FedaPay Direct RDV #{$appointment->id}: " . $e->getMessage());
            return [
                'error' => $e->getMessage()
            ];
        }
    }
}
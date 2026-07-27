<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Mail\AppointmentExpiredMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ExpirePendingAppointments extends Command
{
    protected $signature = 'appointments:expire-pending';
    protected $description = 'Expire les rendez-vous en attente de paiement (24h ou créneau dépassé) et ajuste les créneaux.';

    public function handle()
    {
        $expirationThreshold = Carbon::now()->subHours(24);
        $now = Carbon::now();

        // Récupérer tous les RDV en attente de paiement ayant dépassé les 24h ou le créneau
        $expiredAppointments = Appointment::with(['slot', 'patient'])
            ->where('status', 'EN_ATTENTE_PAIEMENT')
            ->where(function ($query) use ($expirationThreshold, $now) {
                $query->where('created_at', '<=', $expirationThreshold)
                      ->orWhereHas('slot', function ($slotQuery) use ($now) {
                          $slotQuery->where('date_consultation', '<', $now->toDateString())
                                    ->orWhere(function ($q) use ($now) {
                                        $q->where('date_consultation', '=', $now->toDateString())
                                          ->where('start_time', '<=', $now->toTimeString());
                                    });
                      });
            })
            ->get();

        if ($expiredAppointments->isEmpty()) {
            $this->info('Aucun rendez-vous à expirer.');
            return Command::SUCCESS;
        }

        $count = 0;

        foreach ($expiredAppointments as $appointment) {
            DB::beginTransaction();
            try {
                // 1. Mettre à jour le statut du RDV en BD
                $appointment->update([
                    'status' => 'EXPIRE',
                    'cancellation_reason' => 'Expiration automatique : délai de paiement dépassé (24h) ou créneau passé.'
                ]);

                // 2. Mettre à jour le créneau associé
                if ($appointment->slot) {
                    $slot = $appointment->slot;
                    $slotStart = Carbon::parse("{$slot->date_consultation} {$slot->start_time}");
                    $isFuture = $slotStart->isFuture();

                    $slot->update([
                        'status' => $isFuture ? 'Disponible' : 'Indisponible',
                        'is_available' => $isFuture,
                        'reserved_until' => null,
                    ]);
                }

                // 3. Envoyer le mail au patient (si présent)
                if ($appointment->patient && $appointment->patient->email) {
                    Mail::to($appointment->patient->email)
                        ->send(new AppointmentExpiredMail($appointment));
                }

                DB::commit();
                $count++;
                Log::info("RDV #{$appointment->id} marqué comme EXPIRE en BD et créneau libéré.");

            } catch (\Exception $e) {
                DB::rollBack();
                Log::error("Échec expiration RDV #{$appointment->id} : " . $e->getMessage());
                $this->error("Erreur sur le RDV #{$appointment->id}");
            }
        }

        $this->info("{$count} rendez-vous expiré(s) et synchronisé(s) en BD.");
        return Command::SUCCESS;
    }
}

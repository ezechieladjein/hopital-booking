<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Slot;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ExpirePendingAppointments extends Command
{
    /**
     * Le nom et la signature de la commande Artisan.
     *
     * @var string
     */
    protected $signature = 'appointments:expire-pending';

    /**
     * La description de la commande.
     *
     * @var string
     */
    protected $description = 'Expire les rendez-vous en attente de paiement depuis plus de 24h et libère les créneaux.';

    /**
     * Exécute la commande.
     */
    public function handle()
    {
        $expirationTime = Carbon::now()->subHours(24);

        // Récupération des rendez-vous concernés
        $expiredAppointments = Appointment::where('status', 'EN_ATTENTE_PAIEMENT')
            ->where('created_at', '<=', $expirationTime)
            ->get();

        if ($expiredAppointments->isEmpty()) {
            $this->info('Aucun rendez-vous à expirer.');
            return Command::SUCCESS;
        }

        $count = 0;

        foreach ($expiredAppointments as $appointment) {
            DB::beginTransaction();
            try {
                // 1. Mettre à jour le statut du rendez-vous
                $appointment->update([
                    'status' => 'ANNULE_EXPIRATION',
                    'cancellation_reason' => 'Expiration automatique : délai de paiement dépassé (24h).'
                ]);

                // 2. Libérer le créneau associé s'il existe
                if ($appointment->slot_id) {
                    Slot::where('id', $appointment->slot_id)->update([
                        'status' => 'Disponible',
                        'is_available' => true
                    ]);
                }

                DB::commit();
                $count++;

                Log::info("RDV #{$appointment->id} expiré automatiquement (Créneau #{$appointment->slot_id} libéré).");

            } catch (\Exception $e) {
                DB::rollBack();
                Log::error("Erreur lors de l'expiration du RDV #{$appointment->id} : " . $e->getMessage());
                $this->error("Erreur sur le RDV #{$appointment->id}");
            }
        }

        $this->info("{$count} rendez-vous expiré(s) avec succès.");
        return Command::SUCCESS;
    }
}
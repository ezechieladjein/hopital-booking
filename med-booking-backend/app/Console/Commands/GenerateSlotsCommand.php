<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\SlotGeneratorService;
use Carbon\Carbon;

class GenerateSlotsCommand extends Command
{
    // Nom de la commande à taper dans le terminal
    protected $signature = 'med:generate-slots {doctor_id}';
    protected $description = 'Génère automatiquement les créneaux horaires vides pour un médecin sur les 7 prochains jours';

    public function handle(SlotGeneratorService $generatorService)
    {
        $doctorId = $this->argument('doctor_id');
        
        // Période : de demain jusqu'à dans 7 jours
        $startDate = Carbon::tomorrow()->format('Y-m-d');
        $endDate = Carbon::tomorrow()->addDays(7)->format('Y-m-d');

        $this->info("Calcul et découpage du temps en cours pour le médecin ID: {$doctorId}...");
        
        $count = $generatorService->generateForDoctor($doctorId, $startDate, $endDate);

        $this->info("Terminé ! {$count} créneaux de consultation ont été créés avec succès !");
    }
}
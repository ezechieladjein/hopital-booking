<?php

namespace App\Services;

use App\Models\Doctor;
use App\Models\Slot;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class SlotGeneratorService
{
    /**
     * Génère les créneaux disponibles pour un médecin sur une période donnée.
     */
    public function generateForDoctor(int $doctorId, string $startDate, string $endDate): int
    {
        $doctor = Doctor::with(['speciality', 'availabilities'])->findOrFail($doctorId);
        $duration = $doctor->speciality->duree_consultation; // En minutes (ex: 30)
        
        // On crée une période jour par jour entre la date de début et de fin
        $period = CarbonPeriod::create($startDate, $endDate);
        $slotsCreated = 0;

        foreach ($period as $date) {
            // Carbon donne le jour de la semaine (1 = Lundi, 7 = Dimanche)
            $dayOfWeek = $date->dayOfWeekIso;

            // On cherche si le médecin travaille ce jour-là
            $availabilities = $doctor->availabilities->where('day_of_week', $dayOfWeek);

            foreach ($availabilities as $availability) {
                // On initialise le pointeur du créneau à l'heure de début
                $startTime = Carbon::parse($date->format('Y-m-d') . ' ' . $availability->start_time);
                $endTime = Carbon::parse($date->format('Y-m-d') . ' ' . $availability->end_time);

                // Tant qu'on peut insérer un créneau complet dans la tranche horaire
                while ($startTime->copy()->addMinutes($duration)->lte($endTime)) {
                    $slotStart = $startTime->format('H:i:s');
                    $slotEnd = $startTime->copy()->addMinutes($duration)->format('H:i:s');

                    // Sécurité anti-doublon : on vérifie si ce créneau exact n'existe pas déjà
                    $exists = Slot::where('doctor_id', $doctorId)
                        ->where('date_consultation', $date->format('Y-m-d'))
                        ->where('start_time', $slotStart)
                        ->where('end_time', $slotEnd)
                        ->exists();

                    if (!$exists) {
                        Slot::create([
                            'doctor_id' => $doctorId,
                            'date_consultation' => $date->format('Y-m-d'),
                            'start_time' => $slotStart,
                            'end_time' => $slotEnd,
                            'status' => 'Disponible',
                        ]);
                        $slotsCreated++;
                    }

                    // On avance le pointeur du temps de la durée d'une consultation
                    $startTime->addMinutes($duration);
                }
            }
        }

        return $slotsCreated;
    }
}
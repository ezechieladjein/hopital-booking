<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Speciality;
use App\Models\Doctor;
use App\Models\Slot;
use Carbon\Carbon;

class CatalogSeeder extends Seeder
{
    public function run()
    {
        // 1. Définition complète du catalogue extrait du fichier Excel
        $catalog = [
            [
                'nom' => 'Médecine Générale', 'duree' => 15, 'tarif' => 15000,
                'doctors' => [
                    ['nom' => 'Lawson', 'prenom' => 'Koffi', 'jours' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Agbavon', 'prenom' => 'Amélie', 'jours' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                    ['nom' => 'Bio', 'prenom' => 'Sanoussi', 'jours' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Houngbédji', 'prenom' => 'Marc', 'jours' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], 'debut' => '14:00', 'fin' => '18:00'],
                    ['nom' => 'Mensah', 'prenom' => 'Chimène', 'jours' => ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Soglo', 'prenom' => 'Charly', 'jours' => ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                    ['nom' => 'Dossou', 'prenom' => 'Rodrigue', 'jours' => ['Monday', 'Wednesday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Diallo', 'prenom' => 'Fatoumata', 'jours' => ['Monday', 'Tuesday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                ]
            ],
            [
                'nom' => 'Pédiatrie', 'duree' => 20, 'tarif' => 20000,
                'doctors' => [
                    ['nom' => 'Kpadonou', 'prenom' => 'Léa', 'jours' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'debut' => '09:00', 'fin' => '13:00'],
                    ['nom' => 'Adéoti', 'prenom' => 'Ganiou', 'jours' => ['Monday', 'Tuesday', 'Thursday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Tchibozo', 'prenom' => 'Boris', 'jours' => ['Monday', 'Wednesday', 'Thursday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                    ['nom' => 'N’Diaye', 'prenom' => 'Aminata', 'jours' => ['Tuesday', 'Wednesday', 'Friday'], 'debut' => '09:00', 'fin' => '12:00'],
                ]
            ],
            [
                'nom' => 'Gynécologie-Obs.', 'duree' => 30, 'tarif' => 25000,
                'doctors' => [
                    ['nom' => 'Zohoun', 'prenom' => 'Valérie', 'jours' => ['Monday', 'Wednesday', 'Friday'], 'debut' => '08:00', 'fin' => '13:00'],
                    ['nom' => 'Quenum', 'prenom' => 'Christian', 'jours' => ['Monday', 'Tuesday', 'Thursday'], 'debut' => '13:00', 'fin' => '18:00'],
                    ['nom' => 'd’Almeida', 'prenom' => 'Isabelle', 'jours' => ['Tuesday', 'Wednesday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Assogba', 'prenom' => 'Bienvenu', 'jours' => ['Wednesday', 'Thursday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                ]
            ],
            [
                'nom' => 'Cardiologie', 'duree' => 30, 'tarif' => 30000,
                'doctors' => [
                    ['nom' => 'Gbaguidi', 'prenom' => 'Hubert', 'jours' => ['Monday', 'Thursday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Kodjo', 'prenom' => 'Elom', 'jours' => ['Tuesday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                    ['nom' => 'Salami', 'prenom' => 'Rafiatou', 'jours' => ['Wednesday', 'Friday'], 'debut' => '09:00', 'fin' => '13:00'],
                ]
            ],
            [
                'nom' => 'Dentisterie', 'duree' => 30, 'tarif' => 20000,
                'doctors' => [
                    ['nom' => 'Adebayo', 'prenom' => 'Samuel', 'jours' => ['Monday', 'Tuesday', 'Wednesday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Degboé', 'prenom' => 'Florence', 'jours' => ['Wednesday', 'Thursday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Kouamé', 'prenom' => 'Jean', 'jours' => ['Monday', 'Tuesday', 'Friday'], 'debut' => '13:00', 'fin' => '17:00'],
                ]
            ],
            [
                'nom' => 'Psychologie', 'duree' => 45, 'tarif' => 25000,
                'doctors' => [
                    ['nom' => 'Houndégnon', 'prenom' => 'Serge', 'jours' => ['Monday', 'Tuesday', 'Wednesday'], 'debut' => '14:00', 'fin' => '17:00'],
                    ['nom' => 'Olivier', 'prenom' => 'Claire', 'jours' => ['Wednesday', 'Thursday', 'Friday'], 'debut' => '09:00', 'fin' => '12:00'],
                    ['nom' => 'Alao', 'prenom' => 'Ibrahim', 'jours' => ['Monday', 'Tuesday', 'Thursday'], 'debut' => '14:00', 'fin' => '17:00'],
                ]
            ],
            [
                'nom' => 'Dermatologie', 'duree' => 20, 'tarif' => 25000,
                'doctors' => [
                    ['nom' => 'Ahoussi', 'prenom' => 'Nadine', 'jours' => ['Tuesday', 'Thursday'], 'debut' => '09:00', 'fin' => '12:00'],
                    ['nom' => 'Bello', 'prenom' => 'Karim', 'jours' => ['Monday', 'Wednesday'], 'debut' => '14:00', 'fin' => '17:00'],
                ]
            ],
            [
                'nom' => 'Ophtalmologie', 'duree' => 25, 'tarif' => 20000,
                'doctors' => [
                    ['nom' => 'Vignikin', 'prenom' => 'Euloge', 'jours' => ['Monday', 'Wednesday'], 'debut' => '08:00', 'fin' => '12:10'],
                    ['nom' => 'Baba-Moussa', 'prenom' => 'Farid', 'jours' => ['Tuesday', 'Thursday'], 'debut' => '13:30', 'fin' => '17:40'],
                ]
            ],
            [
                'nom' => 'ORL', 'duree' => 20, 'tarif' => 25000,
                'doctors' => [
                    ['nom' => 'Tchégnon', 'prenom' => 'Robert', 'jours' => ['Wednesday', 'Friday'], 'debut' => '08:00', 'fin' => '11:00'],
                    ['nom' => 'Akplogan', 'prenom' => 'Sonia', 'jours' => ['Tuesday', 'Thursday'], 'debut' => '14:00', 'fin' => '17:00'],
                ]
            ],
            [
                'nom' => 'Gastro-entérologie', 'duree' => 30, 'tarif' => 30000,
                'doctors' => [
                    ['nom' => 'Hounkpatin', 'prenom' => 'Ulrich', 'jours' => ['Tuesday', 'Thursday'], 'debut' => '14:00', 'fin' => '18:00'],
                    ['nom' => 'Diop', 'prenom' => 'Mouhamadou', 'jours' => ['Monday', 'Friday'], 'debut' => '08:00', 'fin' => '12:00'],
                ]
            ],
            [
                'nom' => 'Rhumatologie', 'duree' => 25, 'tarif' => 30000,
                'doctors' => [
                    ['nom' => 'Lokossou', 'prenom' => 'Justin', 'jours' => ['Wednesday', 'Friday'], 'debut' => '09:00', 'fin' => '12:20'],
                    ['nom' => 'Ayité', 'prenom' => 'Pascaline', 'jours' => ['Monday', 'Tuesday'], 'debut' => '08:00', 'fin' => '11:20'],
                ]
            ],
            [
                'nom' => 'Neurologie', 'duree' => 30, 'tarif' => 35000,
                'doctors' => [
                    ['nom' => 'Chabi', 'prenom' => 'Saliou', 'jours' => ['Tuesday', 'Thursday'], 'debut' => '08:00', 'fin' => '12:00'],
                    ['nom' => 'Kérékou', 'prenom' => 'Richard', 'jours' => ['Monday', 'Friday'], 'debut' => '14:00', 'fin' => '18:00'],
                ]
            ]
        ];

        // 2. Génération automatique pour les 14 prochains jours
        foreach ($catalog as $sData) {
            $speciality = Speciality::updateOrCreate(
                ['nom' => $sData['nom']],
                ['duree_consultation' => $sData['duree'], 'tarif' => $sData['tarif']]
            );

            foreach ($sData['doctors'] as $dData) {
                $doctor = Doctor::updateOrCreate(
                    ['nom' => $dData['nom'], 'prenom' => $dData['prenom']],
                    ['speciality_id' => $speciality->id]
                );

                // Algorithme de génération des créneaux horaires (Slots)
                for ($i = 0; $i < 14; $i++) {
                    $date = Carbon::today()->addDays($i);

                    // Si le médecin est censé travailler ce jour-là
                    if (in_array($date->format('l'), $dData['jours'])) {

                        $startTime = Carbon::parse($date->format('Y-m-d') . ' ' . $dData['debut']);
                        $endTime = Carbon::parse($date->format('Y-m-d') . ' ' . $dData['fin']);

                        // Découpage dynamique en fonction de la durée de la spécialité
                        while ($startTime->copy()->addMinutes($sData['duree'])->lte($endTime)) {
                            Slot::updateOrCreate([
                                'doctor_id' => $doctor->id,
                                'date_consultation' => $date->format('Y-m-d'),
                                'start_time' => $startTime->format('H:i:s'),
                                'end_time' => $startTime->copy()->addMinutes($sData['duree'])->format('H:i:s'),
                            ], [
                                'status' => 'Disponible'
                            ]);

                            $startTime->addMinutes($sData['duree']);
                        }
                    }
                }
            }
        }
    }
}
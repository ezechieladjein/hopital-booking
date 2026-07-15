<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\DoctorAvailability;

class DoctorAvailabilitySeeder extends Seeder
{
    public function run(): void
    {
        // On donne des dispo théoriques au Dr AGBOSSA (ID 1)
        // Lundi (1) de 08h à 12h
        DoctorAvailability::create([
            'doctor_id' => 1,
            'day_of_week' => 1, 
            'start_time' => '08:00:00',
            'end_time' => '12:00:00',
        ]);

        // Mardi (2) de 08h à 12h
        DoctorAvailability::create([
            'doctor_id' => 1,
            'day_of_week' => 2,
            'start_time' => '08:00:00',
            'end_time' => '12:00:00',
        ]);
    }
}
<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Exécute la vérification toutes les heures (ou chaque minute avec ->everyMinute())
Schedule::command('appointments:expire-pending')->everyFifteenMinutes();

// Vérification de l'envoi des rappels toutes les heures
Schedule::command('appointments:send-reminders')->hourly();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

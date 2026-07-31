<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Expiration des rendez-vous en attente de paiement toutes les 15 minutes
Schedule::command('appointments:expire-pending')->everyFifteenMinutes();

// Envoi des rappels de rendez-vous toutes les heures
Schedule::command('appointments:send-reminders')->hourly();

// Synchronisation des utilisateurs Keycloak toutes les 5 minutes
Schedule::command('keycloak:sync-users')->everyFiveMinutes();

// Génération des créneaux pour tous les médecins à minuit chaque jour
Schedule::command('med:generate-slots')->dailyAt('00:00');

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');


<?php

namespace App\Listeners;

use App\Events\AppointmentEvent;
use App\Services\NotificationService;
use App\Mail\AppointmentCreatedMail;
use App\Mail\AppointmentUpdatedMail;
use App\Mail\AppointmentCancelledMail;
use App\Mail\AppointmentRefusedMail;

class SendAppointmentNotification
{
    public function handle(AppointmentEvent $event): void
    {
        $appointment = $event->appointment;
        $patient = $appointment->patient; // Relation Eloquent vers le Modèle User/Patient

        if (!$patient || !$patient->keycloak_uuid) {
            return;
        }

        $mailable = null;
        $title = '';
        $message = '';

        switch ($event->action) {
            case 'created':
                $mailable = new AppointmentCreatedMail($appointment);
                $title = 'Rendez-vous confirmé';
                $message = "Votre rendez-vous du {$appointment->date_rdv} a été bien enregistré.";
                break;

            case 'updated':
                $mailable = new AppointmentUpdatedMail($appointment);
                $title = 'Rendez-vous modifié';
                $message = "La date de votre rendez-vous a été mise à jour au {$appointment->date_rdv}.";
                break;

            case 'cancelled':
                $mailable = new AppointmentCancelledMail($appointment);
                $title = 'Rendez-vous annulé';
                $message = "Votre rendez-vous du {$appointment->date_rdv} a été annulé.";
                break;

            case 'refused':
                $mailable = new AppointmentRefusedMail($appointment);
                $title = 'Rendez-vous refusé';
                $message = "Votre demande de rendez-vous pour le {$appointment->date_rdv} n'a pas pu être validée.";
                break;
        }

        if ($mailable) {
            NotificationService::notifyAndMail(
                $patient->keycloak_uuid,
                $patient->email,
                $mailable,
                $title,
                $message,
                'appointment',
                [
                    'appointment_id' => $appointment->id,
                    'date_rdv'       => $appointment->date_rdv,
                    'action'         => $event->action
                ]
            );
        }
    }
}
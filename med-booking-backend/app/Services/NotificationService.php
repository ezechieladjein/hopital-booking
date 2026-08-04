<?php

namespace App\Services;

use App\Models\Notification;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Envoie un mail et enregistre la notification pour l'utilisateur
     */
    public static function notifyAndMail(string $userUuid, string $recipientEmail, $mailable, string $title, string $message, string $type = 'email', array $data = []): void
    {
        // 1. Enregistrement en base de données SQL
        Notification::create([
            'user_uuid' => $userUuid,
            'title'     => $title,
            'message'   => $message,
            'type'      => $type,
            'data'      => $data,
            'read'      => false,
        ]);

        // 2. Envoi réel du mail via Laravel Mail
        if (!empty($recipientEmail)) {
            Mail::to($recipientEmail)->send($mailable);
        }
    }
}
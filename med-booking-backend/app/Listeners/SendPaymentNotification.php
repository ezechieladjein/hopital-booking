<?php

namespace App\Listeners;

use App\Events\PaymentEvent;
use App\Services\NotificationService;
use App\Mail\PaymentSuccessfulMail;
use App\Mail\PaymentFailedMail;
use App\Mail\PaymentLinkMail;
use App\Mail\RefundEffectedMail;

class SendPaymentNotification
{
    public function handle(PaymentEvent $event): void
    {
        $payment = $event->payment;
        $user = $payment->user; // Ou $payment->patient selon la relation dans votre modèle Payment

        if (!$user || !$user->keycloak_uuid) {
            return;
        }

        $mailable = null;
        $title = '';
        $message = '';

        switch ($event->action) {
            case 'success':
                $mailable = new PaymentSuccessfulMail($payment);
                $title = 'Paiement confirmé';
                $message = "Votre paiement de {$payment->amount} FCFA a été validé avec succès.";
                break;

            case 'failed':
                $mailable = new PaymentFailedMail($payment);
                $title = 'Échec de paiement';
                $message = "Le règlement de {$payment->amount} FCFA n'a pas pu aboutir. Veuillez réessayer.";
                break;

            case 'link_generated':
                $mailable = new PaymentLinkMail($payment);
                $title = 'Lien de paiement disponible';
                $message = "Un lien de paiement pour votre consultation est disponible.";
                break;

            case 'refunded':
                $mailable = new RefundEffectedMail($payment);
                $title = 'Remboursement effectué';
                $message = "Le remboursement de {$payment->amount} FCFA a été traité.";
                break;
        }

        if ($mailable) {
            NotificationService::notifyAndMail(
                $user->keycloak_uuid,
                $user->email,
                $mailable,
                $title,
                $message,
                'payment',
                [
                    'payment_id' => $payment->id,
                    'amount'     => $payment->amount,
                    'action'     => $event->action,
                ]
            );
        }
    }
}
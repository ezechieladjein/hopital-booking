<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentRefusedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment,
        public string $reason = 'Motif non spécifié'
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Refus de votre demande de rendez-vous',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.appointments.refused',
            with: [
                'appointment' => $this->appointment,
                'reason'      => $this->reason,
            ],
        );
    }
}
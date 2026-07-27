<?php
namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentUpdatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Modification de votre rendez-vous',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.appointments.updated',
            with: [
                'appointment' => $this->appointment,
            ],
        );
    }
}
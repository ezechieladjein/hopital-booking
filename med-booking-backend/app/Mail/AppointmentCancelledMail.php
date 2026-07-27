<?php
namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentCancelledMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment,
        public string $cancelledBy = 'L\'établissement',
        public ?string $reason = null
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Annulation de rendez-vous',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.appointments.cancelled',
            with: [
                'appointment' => $this->appointment,
                'cancelledBy' => $this->cancelledBy,
                'reason'      => $this->reason,
            ],
        );
    }
}
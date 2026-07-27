<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InsuranceValidatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $paymentUrl;

    public function __construct(
        public Appointment $appointment,
        ?string $paymentUrl = null
    ) {
        $frontendUrl = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
        $this->paymentUrl = $paymentUrl ?? "{$frontendUrl}/payment?appointment_id={$appointment->id}";
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Prise en charge assurance validée',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.appointments.insurance_validated',
            with: [
                'appointment' => $this->appointment,
                'paymentUrl'  => $this->paymentUrl,
            ],
        );
    }
}
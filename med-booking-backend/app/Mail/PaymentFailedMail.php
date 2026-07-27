<?php
namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentFailedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment,
        public string $paymentUrl
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Échec de paiement',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.payments.failed',
            with: [
                'appointment' => $this->appointment,
                'paymentUrl'  => $this->paymentUrl,
            ],
        );
    }
}
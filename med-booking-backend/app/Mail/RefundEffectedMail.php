<?php
namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RefundEffectedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment,
        public float|int $amount
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Confirmation de remboursement',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.payments.refunded',
            with: [
                'appointment' => $this->appointment,
                'amount'      => $this->amount,
            ],
        );
    }
}
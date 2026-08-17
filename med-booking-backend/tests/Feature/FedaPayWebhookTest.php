<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Appointment;
use App\Models\Payment;
use Illuminate\Support\Facades\Mail;

class FedaPayWebhookTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_processes_approved_fedapay_transaction_successfully()
    {
        Mail::fake();

        // 1. RDV et Paiement en attente
        $appointment = Appointment::create([
            'patient_uuid'     => 'patient-uuid-100',
            'patient_email'    => 'patient@example.com',
            'doctor_id'        => 1,
            'appointment_date' => '2026-08-12 09:00:00',
            'status'           => 'pending',
        ]);

        $payment = Payment::create([
            'appointment_id' => $appointment->id,
            'reference'      => 'TX_FEDAPAY_998877',
            'amount'         => 15000,
            'status'         => 'pending',
        ]);

        // 2. Mock du payload envoyé par le Webhook FedaPay
        $webhookPayload = [
            'entity' => 'event',
            'name'   => 'transaction.approved',
            'object' => [
                'id'            => 1234,
                'reference'     => 'TX_FEDAPAY_998877',
                'amount'        => 15000,
                'status'        => 'approved',
                'custom_metadata' => [
                    'appointment_id' => $appointment->id,
                ],
            ]
        ];

        // 3. Exécution du POST
        $response = $this->postJson('/api/webhooks/fedapay', $webhookPayload);

        $response->assertStatus(200);

        // 4. Vérifications
        $this->assertDatabaseHas('payments', [
            'id'     => $payment->id,
            'status' => 'approved',
        ]);

        $this->assertDatabaseHas('appointments', [
            'id'     => $appointment->id,
            'status' => 'confirmed',
        ]);

        // Notification créée en BDD
        $this->assertDatabaseHas('notifications', [
            'user_uuid' => 'patient-uuid-100',
            'type'      => 'payment',
        ]);
    }

    /** @test */
    public function it_ignores_unhandled_webhook_events()
    {
        $webhookPayload = [
            'entity' => 'event',
            'name'   => 'transaction.canceled',
            'object' => [
                'reference' => 'TX_CANCELLED_001',
            ]
        ];

        $response = $this->postJson('/api/webhooks/fedapay', $webhookPayload);

        $response->assertStatus(200);
    }
}
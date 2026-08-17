<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Appointment;
use App\Models\Doctor;
use Illuminate\Support\Facades\Mail;

class AppointmentTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function a_patient_can_book_an_appointment()
    {
        Mail::fake();

        $payload = [
            'patient_uuid'     => 'patient-uuid-001',
            'patient_name'     => 'Salomon Ezechiel',
            'patient_email'    => 'salomon@example.com',
            'doctor_id'        => 1,
            'appointment_date' => '2026-08-10 10:00:00',
            'reason'           => 'Consultation générale',
        ];

        $response = $this->postJson('/api/appointments', $payload);

        $response->assertStatus(201)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('appointments', [
            'patient_uuid'     => 'patient-uuid-001',
            'appointment_date' => '2026-08-10 10:00:00',
            'status'           => 'pending',
        ]);
    }

    /** @test */
    public function double_booking_on_same_slot_is_prevented()
    {
        // On crée un premier RDV déjà réservé
        Appointment::create([
            'patient_uuid'     => 'existing-patient',
            'doctor_id'        => 1,
            'appointment_date' => '2026-08-10 10:00:00',
            'status'           => 'confirmed',
        ]);

        $payload = [
            'patient_uuid'     => 'new-patient',
            'doctor_id'        => 1,
            'appointment_date' => '2026-08-10 10:00:00',
            'reason'           => 'Consultation de contrôle',
        ];

        $response = $this->postJson('/api/appointments', $payload);

        // Erreur de validation ou conflit 422 / 409
        $response->assertStatus(422);
    }

    /** @test */
    public function a_secretary_can_update_appointment_status()
    {
        $appointment = Appointment::create([
            'patient_uuid'     => 'patient-uuid-002',
            'doctor_id'        => 1,
            'appointment_date' => '2026-08-11 14:00:00',
            'status'           => 'pending',
        ]);

        $response = $this->putJson("/api/appointments/{$appointment->id}", [
            'status' => 'confirmed',
        ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('appointments', [
            'id'     => $appointment->id,
            'status' => 'confirmed',
        ]);
    }
}
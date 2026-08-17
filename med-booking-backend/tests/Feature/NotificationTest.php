<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
use App\Services\NotificationService;
use App\Models\Notification;
use App\Mail\AppointmentConfirmationMail; // Adaptez selon votre Mailable

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_creates_notification_in_database_and_sends_email_via_service()
    {
        Mail::fake();

        $userUuid = 'usr-uuid-12345';
        $email = 'patient@example.com';
        $title = 'Rendez-vous confirmé';
        $message = 'Votre RDV est fixé au 15 Août 2026';

        // Fake Mailable simple
        $mailable = new class extends \Illuminate\Mail\Mailable {
            public function build() {
                return $this->html('Confirmation RDV');
            }
        };

        NotificationService::notifyAndMail(
            $userUuid,
            $email,
            $mailable,
            $title,
            $message,
            'appointment',
            ['appointment_id' => 42]
        );

        // 1. Vérification en Base de Données
        $this->assertDatabaseHas('notifications', [
            'user_uuid' => $userUuid,
            'title'     => $title,
            'message'   => $message,
            'type'      => 'appointment',
            'read'      => false,
        ]);

        // 2. Vérification de l'envoi du Mail
        Mail::assertSent(get_class($mailable), function ($mail) use ($email) {
            return $mail->hasTo($email);
        });
    }

    /** @test */
    public function it_fetches_notifications_for_a_specific_user_uuid()
    {
        $userUuid = 'usr-uuid-99999';

        Notification::create([
            'user_uuid' => $userUuid,
            'title'     => 'Note 1',
            'message'   => 'Message 1',
            'type'      => 'appointment',
            'read'      => false,
        ]);

        Notification::create([
            'user_uuid' => 'other-user-uuid',
            'title'     => 'Autre note',
            'message'   => 'Autre message',
            'type'      => 'payment',
            'read'      => false,
        ]);

        $response = $this->withHeaders([
            'X-User-UUID' => $userUuid,
            'Accept'      => 'application/json',
        ])->getJson('/api/notifications');

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                 ])
                 ->assertJsonCount(1, 'data')
                 ->assertJsonFragment(['title' => 'Note 1']);
    }

    /** @test */
    public function it_marks_all_notifications_as_read_for_a_user()
    {
        $userUuid = 'usr-uuid-read-test';

        Notification::create([
            'user_uuid' => $userUuid,
            'title'     => 'Unread 1',
            'message'   => 'Msg 1',
            'type'      => 'alert',
            'read'      => false,
        ]);

        $response = $this->withHeaders([
            'X-User-UUID' => $userUuid,
            'Accept'      => 'application/json',
        ])->postJson('/api/notifications/mark-as-read', [
            'user_uuid' => $userUuid,
        ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('notifications', [
            'user_uuid' => $userUuid,
            'read'      => false,
        ]);
    }
}
<?php

use Illuminate\Support\Facades\Route;
use App\Models\Appointment;
use App\Mail\AppointmentCreatedMail;
use App\Mail\InsuranceValidatedMail;
use App\Mail\AppointmentRefusedMail;
use App\Mail\PaymentLinkMail;
use App\Mail\PaymentSuccessfulMail;
use App\Mail\PaymentFailedMail;
use App\Mail\AppointmentExpiredMail;
use App\Mail\AppointmentUpdatedMail;
use App\Mail\AppointmentCancelledMail;
use App\Mail\RefundEffectedMail;
use App\Mail\AppointmentReminderMail;

// Accessible uniquement en environnement local
if (app()->environment('local')) {

    Route::prefix('email-previews')->group(function () {

        // Index pour lister toutes les prévisualisations disponibles
        Route::get('/', function () {
            return response()->json([
                'message' => 'Menu des prévisualisations d\'e-mails (Medigo)',
                'links' => [
                    '1. Creation RDV'           => url('/email-previews/created'),
                    '2. Assurance Validee'      => url('/email-previews/insurance-validated'),
                    '3. Assurance Refusee'      => url('/email-previews/insurance-refused'),
                    '4. Lien de Paiement'       => url('/email-previews/payment-link'),
                    '5. Paiement Reussi'        => url('/email-previews/payment-success'),
                    '6. Paiement Echoue'        => url('/email-previews/payment-failed'),
                    '7. RDV Expire'            => url('/email-previews/expired'),
                    '8. RDV Modifie'           => url('/email-previews/updated'),
                    '9. RDV Annule'            => url('/email-previews/cancelled'),
                    '10. Remboursement Effectue' => url('/email-previews/refunded'),
                    '11. Rappel 24h'           => url('/email-previews/reminder'),
                ]
            ]);
        });

        // Fonction Helper pour récupérer un RDV de test avec toutes ses relations
        // Helper pour récupérer un RDV de test avec les bonnes relations
        $getTestAppointment = function () {
            // Eager loading aligné avec votre structure : doctor et speciality
            $appointment = Appointment::with(['patient', 'slot.doctor.speciality'])->first();

            // Si la base de données est vide, on crée un faux objet pour le test
            if (!$appointment) {
                $appointment = new Appointment([
                    'id' => 1,
                    'base_price' => 15000,
                    'amount_to_pay' => 5000,
                    'cancellation_reason' => 'Absence d\'urgence médicale',
                ]);
            }
            return $appointment;
        };

        Route::get('/created', fn() => new AppointmentCreatedMail($getTestAppointment()));
        Route::get('/insurance-validated', fn() => new InsuranceValidatedMail($getTestAppointment()));
        Route::get('/insurance-refused', fn() => new AppointmentRefusedMail($getTestAppointment(),'Indisponibilité exceptionnelle du médecin à cette date.'));
        Route::get('/payment-link', fn() => new PaymentLinkMail($getTestAppointment(), 'https://checkout.fedapay.com/example'));
        Route::get('/payment-success', fn() => new PaymentSuccessfulMail($getTestAppointment()));
        Route::get('/payment-failed', fn() => new PaymentFailedMail($getTestAppointment(), 'https://checkout.fedapay.com/example'));
        Route::get('/expired', fn() => new AppointmentExpiredMail($getTestAppointment()));
        Route::get('/updated', fn() => new AppointmentUpdatedMail($getTestAppointment()));
        Route::get('/cancelled', fn() => new AppointmentCancelledMail($getTestAppointment(), 'L\'établissement', 'Fermeture exceptionnelle du cabinet'));
        Route::get('/refunded', fn() => new RefundEffectedMail($getTestAppointment(), 5000));
        Route::get('/reminder', fn() => new AppointmentReminderMail($getTestAppointment()));
    });
}

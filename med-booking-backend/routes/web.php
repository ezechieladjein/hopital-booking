<?php
use App\Models\Appointment;
use App\Mail\PaymentSuccessfulMail;
use Illuminate\Support\Facades\Mail;

Route::get('/test-email-payment/{id}', function ($id) {
    $appointment = Appointment::with(['patient', 'doctor.user', 'slot'])->findOrFail($id);
    
    // Simuler l'envoi du mail de succès de paiement
    Mail::to('test@example.com')->send(new PaymentSuccessfulMail($appointment));

    return "E-mail de paiement envoyé avec succès pour le RDV #{$appointment->id}";
});
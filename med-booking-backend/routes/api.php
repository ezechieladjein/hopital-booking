<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\MedicalController;
use App\Http\Controllers\API\SecretaryController;
use App\Http\Controllers\API\PaymentController;

// Catalogue & Créneaux publics
Route::get('/catalog', [MedicalController::class, 'getCatalog']);
Route::get('/doctors/{id}/slots', [MedicalController::class, 'getDoctorSlots']);
Route::get('/doctors/{doctor}/available-days', [MedicalController::class, 'getAvailableDays']);
Route::post('/appointments', [MedicalController::class, 'bookAppointment']);

// Espace Secrétariat
Route::prefix('secretary')->group(function () {
    // Rendez-vous & Médecins
    Route::get('/appointments', [SecretaryController::class, 'index']);
    Route::get('/doctors', [SecretaryController::class, 'getDoctors']);
    Route::post('/appointments/{id}/status', [SecretaryController::class, 'updateStatus']);

    // Traitement des Assurances
    Route::post('/validate-insurance', [SecretaryController::class, 'validateInsurance']);
    Route::post('/reject-insurance', [SecretaryController::class, 'rejectInsurance']);

    // Indisponibilités & Blocages ponctuels
    Route::get('/doctors/{doctorId}/unavailabilities', [SecretaryController::class, 'getDoctorUnavailabilities']);
    Route::post('/unavailabilities/block', [SecretaryController::class, 'blockSlotsOrDay']);
    Route::post('/unavailabilities/{id}/unblock', [SecretaryController::class, 'unblockAvailability']);

    // NOUVEAU : Emploi du temps récurrent (doctor_availabilities) & Génération de créneaux
    Route::get('/doctors/{id}/availabilities', [SecretaryController::class, 'getDoctorAvailabilities']);
    Route::post('/doctors/{id}/availabilities', [SecretaryController::class, 'setDoctorAvailabilities']);
    Route::post('/slots/generate', [SecretaryController::class, 'generateDoctorSlots']);
});

// Paiements FedaPay
Route::post('/payments/initiate', [PaymentController::class, 'initiatePayment']);
Route::post('/payments/verify', [PaymentController::class, 'verifyPayment']);
Route::post('/payments/refund', [PaymentController::class, 'refundPayment']);
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\MedicalController;
use App\Http\Controllers\API\SecretaryController;
use App\Http\Controllers\API\PaymentController;
use App\Http\Controllers\API\AdminController;

/*
|--------------------------------------------------------------------------
| Routes API - Application Médicale Hopital / Medigo
|--------------------------------------------------------------------------
*/

// --- Catalogue & Créneaux Publics (Patients) ---
Route::get('/catalog', [MedicalController::class, 'getCatalog']);
Route::get('/doctors/{id}/slots', [MedicalController::class, 'getDoctorSlots']);
Route::get('/doctors/{doctor}/available-days', [MedicalController::class, 'getAvailableDays']);
Route::post('/appointments', [MedicalController::class, 'bookAppointment']);

// --- Gestion des Rendez-vous & Profil Patient ---
Route::get('/patients/{keycloakUuid}/appointments', [MedicalController::class, 'getPatientAppointments']);
Route::put('/appointments/{id}/reschedule', [MedicalController::class, 'rescheduleAppointment']);
Route::post('/appointments/{id}/cancel', [MedicalController::class, 'cancelAppointment']);

// Profil Patient (GET & PUT)
Route::get('/patients/{keycloakUuid}/profile', [MedicalController::class, 'getProfile']);
Route::put('/patients/{keycloakUuid}/profile', [MedicalController::class, 'updateProfile']);

// --- Espace Secrétariat ---
Route::prefix('secretary')->group(function () {
    Route::get('/appointments', [SecretaryController::class, 'index']);
    Route::get('/doctors', [SecretaryController::class, 'getDoctors']);
    Route::post('/appointments/{id}/status', [SecretaryController::class, 'updateStatus']);

    // Assurances
    Route::post('/validate-insurance', [SecretaryController::class, 'validateInsurance']);
    Route::post('/reject-insurance', [SecretaryController::class, 'rejectInsurance']);

    // Indisponibilités Saisies
    Route::get('/doctors/{doctorId}/unavailabilities', [SecretaryController::class, 'getDoctorUnavailabilities']);
    Route::post('/unavailabilities/block', [SecretaryController::class, 'blockSlotsOrDay']);
    Route::post('/unavailabilities/{id}/unblock', [SecretaryController::class, 'unblockAvailability']);

    // Emploi du temps & Créneaux
    Route::get('/doctors/{id}/availabilities', [SecretaryController::class, 'getDoctorAvailabilities']);
    Route::post('/doctors/{id}/availabilities', [SecretaryController::class, 'setDoctorAvailabilities']);
    Route::post('/slots/generate', [SecretaryController::class, 'generateDoctorSlots']);
});

// --- Paiements FedaPay ---
Route::prefix('payments')->group(function () {
    Route::post('/initiate', [PaymentController::class, 'initiatePayment']);
    Route::post('/verify', [PaymentController::class, 'verifyPayment']);
    Route::post('/refund', [PaymentController::class, 'refundPayment']);
    Route::post('/webhook', [PaymentController::class, 'handleWebhook'])
    ->name('payments.webhook');
});

Route::get('/appointments/{appointment}/payment-status', [PaymentController::class, 'getPaymentStatus']);

// --- Espace Administration ---
Route::prefix('admin')->group(function () {
    Route::get('/stats', [AdminController::class, 'getStats']);
    Route::get('/stats/confirmed-details', [AdminController::class, 'getConfirmedDetails']);

    Route::get('/specialities', [AdminController::class, 'getSpecialities']);
    Route::post('/specialities', [AdminController::class, 'storeSpeciality']);
    Route::put('/specialities/{id}', [AdminController::class, 'updateSpeciality']);
    Route::delete('/specialities/{id}', [AdminController::class, 'destroySpeciality']);

    Route::get('/doctors', [AdminController::class, 'getDoctors']);
    Route::post('/doctors', [AdminController::class, 'storeDoctor']);
    Route::patch('/doctors/{id}/toggle-status', [AdminController::class, 'toggleDoctorStatus']);

    Route::get('/unavailabilities', [AdminController::class, 'getUnavailabilities']);

    Route::get('/users/logs', [AdminController::class, 'getUsersLogs']);
    Route::post('/users/staff', [AdminController::class, 'storeStaffUser']);
});
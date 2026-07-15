<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\MedicalController;
use App\Http\Controllers\API\SecretaryController;
use App\Http\Controllers\API\PaymentController;

// URL finale : http://127.0.0.1:8000/api/catalog
Route::get('/catalog', [MedicalController::class, 'getCatalog']);

// URL finale : http://127.0.0.1:8000/api/doctors/{id}/slots?date=YYYY-MM-DD
Route::get('/doctors/{id}/slots', [MedicalController::class, 'getDoctorSlots']);

// URL : http://127.0.0.1:8000/api/appointments
Route::post('/appointments', [MedicalController::class, 'bookAppointment']);

Route::get('/doctors/{doctor}/available-days', [MedicalController::class, 'getAvailableDays']);

// Routes dédiées à l'espace Secrétaire (en local pour le moment)
Route::prefix('secretary')->group(function () {
    Route::get('/appointments', [SecretaryController::class, 'index']);
    Route::post('/validate-insurance', [SecretaryController::class, 'validateInsurance']);
    Route::post('/appointments/{id}/status', [SecretaryController::class, 'updateStatus']);
});

// Routes de paiement FedaPay
Route::post('/payments/initiate', [PaymentController::class, 'initiatePayment']);
Route::post('/payments/callback-handler', [PaymentController::class, 'callbackHandler']);
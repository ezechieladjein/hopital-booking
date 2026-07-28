<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\MedicalController;
use App\Http\Controllers\API\SecretaryController;
use App\Http\Controllers\API\PaymentController;
use App\Http\Controllers\API\AdminController;
use App\Http\Controllers\API\PasswordController;
use App\Http\Middleware\KeycloakJwtAuth;

/*
|--------------------------------------------------------------------------
| Routes API - Application Médicale Hopital / Medigo
|--------------------------------------------------------------------------
*/

// ==========================================
// 1. ROUTES PUBLIQUES (Sans authentification)
// ==========================================

Route::post('/register', [AuthController::class, 'registerPatient']);

Route::get('/catalog', [MedicalController::class, 'getCatalog']);
Route::get('/doctors/{id}/slots', [MedicalController::class, 'getDoctorSlots']);
Route::get('/doctors/{doctor}/available-days', [MedicalController::class, 'getAvailableDays']);

// Changer le mot de passe
Route::middleware([KeycloakJwtAuth::class])->group(function () {
    Route::post('/change-password', [PasswordController::class, 'changePassword']);
});

// Webhook FedaPay (Appelé par FedaPay directement)
Route::post('/payments/webhook', [PaymentController::class, 'handleWebhook'])->name('payments.webhook');


// ==========================================
// 2. ESPACE PATIENT (Rôle : patient)
// ==========================================

Route::middleware([KeycloakJwtAuth::class . ':patient'])->group(function () {
    Route::post('/appointments', [MedicalController::class, 'bookAppointment']);

    // Gestion des RDV du patient
    Route::get('/patients/{keycloakUuid}/appointments', [MedicalController::class, 'getPatientAppointments']);
    Route::put('/appointments/{id}/reschedule', [MedicalController::class, 'rescheduleAppointment']);
    Route::post('/appointments/{id}/cancel', [MedicalController::class, 'cancelAppointment']);

    // Profil Patient
    Route::get('/patients/{keycloakUuid}/profile', [MedicalController::class, 'getProfile']);
    Route::put('/patients/{keycloakUuid}/profile', [MedicalController::class, 'updateProfile']);

    // Paiements
    Route::prefix('payments')->group(function () {
        Route::post('/initiate', [PaymentController::class, 'initiatePayment']);
        Route::post('/verify', [PaymentController::class, 'verifyPayment']);
    });
    Route::get('/appointments/{appointment}/payment-status', [PaymentController::class, 'getPaymentStatus']);
});

Route::get('/check-email', function (Request $request) {
    $email = $request->query('email');
    if (!$email) {
        return response()->json(['exists' => false]);
    }
    $exists = \App\Models\User::where('email', $email)->exists();
    return response()->json(['exists' => $exists]);
});

// ==========================================
// 3. ESPACE SECRÉTARIAT (Rôle : secretary)
// ==========================================

Route::prefix('secretary')->middleware([KeycloakJwtAuth::class . ':secretary'])->group(function () {
    Route::get('/appointments', [SecretaryController::class, 'index']);
    Route::get('/doctors', [SecretaryController::class, 'getDoctors']);
    Route::post('/appointments/{id}/status', [SecretaryController::class, 'updateStatus']);

    // Assurances
    Route::post('/validate-insurance', [SecretaryController::class, 'validateInsurance']);
    Route::post('/reject-insurance', [SecretaryController::class, 'rejectInsurance']);

    // Indisponibilités
    Route::get('/doctors/{doctorId}/unavailabilities', [SecretaryController::class, 'getDoctorUnavailabilities']);
    Route::post('/unavailabilities/block', [SecretaryController::class, 'blockSlotsOrDay']);
    Route::post('/unavailabilities/{id}/unblock', [SecretaryController::class, 'unblockAvailability']);

    // Emploi du temps & Créneaux
    Route::get('/doctors/{id}/availabilities', [SecretaryController::class, 'getDoctorAvailabilities']);
    Route::post('/doctors/{id}/availabilities', [SecretaryController::class, 'setDoctorAvailabilities']);
    Route::post('/slots/generate', [SecretaryController::class, 'generateDoctorSlots']);
    
    // Remboursement (si la secrétaire gère les annulations payées)
    Route::post('/payments/refund', [PaymentController::class, 'refundPayment']);
});


// ==========================================
// 4. ESPACE ADMINISTRATION (Rôle : admin)
// ==========================================

Route::prefix('admin')->middleware([KeycloakJwtAuth::class . ':admin'])->group(function () {
    // Dashboard & Stats
    Route::get('/stats', [AdminController::class, 'getStats']);
    Route::get('/stats/confirmed-details', [AdminController::class, 'getConfirmedDetails']);

    // Gestion des Spécialités
    Route::get('/specialities', [AdminController::class, 'getSpecialities']);
    Route::post('/specialities', [AdminController::class, 'storeSpeciality']);
    Route::put('/specialities/{id}', [AdminController::class, 'updateSpeciality']);
    Route::delete('/specialities/{id}', [AdminController::class, 'destroySpeciality']);

    // Gestion des Médecins
    Route::get('/doctors', [AdminController::class, 'getDoctors']);
    Route::post('/doctors', [AdminController::class, 'storeDoctor']);
    Route::patch('/doctors/{id}/toggle-status', [AdminController::class, 'toggleDoctorStatus']);

    // Indisponibilités globales
    Route::get('/unavailabilities', [AdminController::class, 'getUnavailabilities']);

    // Gestion des Utilisateurs et Comptes Staff
    Route::get('/users/logs', [AdminController::class, 'getUsersLogs']);
    Route::post('/users/staff', [AdminController::class, 'storeStaffUser']);
});

Route::get('/test-keycloak', function () {
    try {
        $baseUrl = config('keycloak.base_url');
        $realm = 'master';
        
        $response = Http::asForm()->post($baseUrl . '/realms/' . $realm . '/protocol/openid-connect/token', [
            'client_id' => 'admin-cli',
            'username' => 'admin',
            'password' => 'AdminPassword123*',
            'grant_type' => 'password',
        ]);
        
        return response()->json([
            'status' => $response->status(),
            'body' => $response->body(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'error' => $e->getMessage()
        ], 500);
    }
});
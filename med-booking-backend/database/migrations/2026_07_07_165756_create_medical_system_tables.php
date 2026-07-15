<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // 1. Table des utilisateurs (Patients, Secrétaires, Admin)
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('keycloak_uuid')->nullable()->unique(); // Synchronisation obligatoire Keycloak
            $table->string('nom', 100);
            $table->string('prenom', 100);
            $table->string('email', 150)->unique();
            $table->string('telephone', 30)->nullable();
            $table->enum('role', ['patient', 'secretaire', 'administrateur']);
            $table->timestamps();
        });

        // 2. Table des spécialités médicales
        Schema::create('specialities', function (Blueprint $table) {
            $table->id();
            $table->string('nom', 100)->unique();
            $table->integer('duree_consultation')->unsigned(); // En minutes (ex: 15)
            $table->integer('tarif')->unsigned(); // En FCFA
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 3. Table des médecins
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('speciality_id')->constrained('specialities')->onDelete('restrict');
            $table->string('nom', 100);
            $table->string('prenom', 100);
            $table->enum('status', ['actif', 'inactif'])->default('actif');
            $table->timestamps();
        });

        // 4. Horaires de travail théoriques des médecins (ex: Lundi 8h-12h)
        Schema::create('doctor_availabilities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained('doctors')->onDelete('cascade');
            $table->tinyInteger('day_of_week')->unsigned(); // 1=Lundi, 7=Dimanche
            $table->time('start_time');
            $table->time('end_time');
            $table->timestamps();
        });

        // 5. Table des créneaux horaires générés par l'algorithme
        Schema::create('slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained('doctors')->onDelete('cascade');
            $table->date('date_consultation');
            $table->time('start_time');
            $table->time('end_time');
            $table->enum('status', ['Disponible', 'Réservé temporairement', 'Occupé', 'Indisponible'])->default('Disponible'); 
            $table->timestamp('reserved_until')->nullable(); // Verrou de blocage temporaire (Sécurité anti-doublon)
            $table->timestamps();

            $table->index(['doctor_id', 'date_consultation', 'status']); // Pour accélérer les recherches du catalogue
        });

        // 6. Table des rendez-vous
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('users')->onDelete('restrict');
            $table->foreignId('slot_id')->unique()->constrained('slots')->onDelete('restrict'); // Unicité stricte : 1 créneau = 1 rendez-vous max
            $table->enum('status', [
                'EN_ATTENTE_VALIDATION', 'EN_ATTENTE_PAIEMENT', 'CONFIRME', 
                'EXPIRE', 'TERMINE', 'ABSENT', 'ANNULE_PATIENT', 'ANNULE_HOPITAL'
            ])->default('EN_ATTENTE_PAIEMENT'); 
            $table->boolean('has_insurance')->default(false);
            $table->string('insurance_name', 100)->nullable();
            $table->string('insurance_policy_number', 100)->nullable();
            $table->string('insurance_document_path')->nullable();
            $table->tinyInteger('insurance_coverage_rate')->unsigned()->default(0); // Taux de prise en charge (ex: 80%)
            $table->foreignId('validated_by')->nullable()->constrained('users')->onDelete('restrict'); // Secrétaire qui a validé
            $table->integer('base_price')->unsigned(); // Tarif initial en FCFA
            $table->integer('amount_to_pay')->unsigned(); // Reste à payer après assurance
            $table->string('cancellation_reason')->nullable(); 
            $table->timestamps();
        });

        // 7. Table des paiements FedaPay
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->onDelete('restrict');
            $table->string('fedapay_transaction_id', 100)->unique(); 
            $table->enum('payment_method', ['mobile_money', 'card']);
            $table->integer('amount_paid')->unsigned();
            $table->enum('status', ['pending', 'approved', 'declined', 'refunded', 'partially_refunded'])->default('pending');
            $table->string('fedapay_receipt_url')->nullable();
            $table->integer('refunded_amount')->unsigned()->default(0); 
            $table->timestamps();
        });

        // 8. Table des indisponibilités exceptionnelles (Congés, urgences)
        Schema::create('doctor_unavailabilities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained('doctors')->onDelete('cascade');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        // Suppression dans l'ordre inverse des clés étrangères pour éviter les blocages
        Schema::dropIfExists('doctor_unavailabilities');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('slots');
        Schema::dropIfExists('doctor_availabilities');
        Schema::dropIfExists('doctors');
        Schema::dropIfExists('specialities');
        Schema::dropIfExists('users');
    }
};
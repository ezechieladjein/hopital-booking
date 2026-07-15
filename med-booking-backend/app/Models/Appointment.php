<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    // On liste explicitement TOUS les champs que Laravel a le droit d'écrire en base
    protected $fillable = [
        'patient_id',
        'slot_id',
        'status',
        'base_price',
        'amount_to_pay',
        'has_insurance',
        // 🚀 AJOUTS INDISPENSABLES : Autoriser l'écriture des infos d'assurance
        'insurance_name',
        'insurance_policy_number',
        'insurance_document_path',
        'insurance_coverage_rate', // Nécessaire aussi pour quand la secrétaire mettra à jour le taux !
    ];

    /**
     * Relation avec le créneau horaire
     */
    public function slot(): BelongsTo
    {
        // On s'assure d'apporter le Slot
        return $this->belongsTo(Slot::class);
    }

    /**
     * 🚀 AJOUT CRUCIAL : Relie le rendez-vous au Patient (qui est dans la table Users)
     */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }
}
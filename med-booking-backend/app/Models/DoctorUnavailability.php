<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DoctorUnavailability extends Model
{
    use HasFactory;

    protected $table = 'doctor_unavailabilities';

    /**
     * Les champs autorisés lors de la création via DoctorUnavailability::create()
     */
    protected $fillable = [
        'doctor_id',
        'start_datetime',
        'end_datetime',
        'is_full_day',
        'type',
        'reason',
        'status',
        'created_by',
        'cancelled_by',
        'cancelled_at',
    ];

    /**
     * Relation avec le médecin concerné
     */
    public function doctor()
    {
        return $this->belongsTo(Doctor::class);
    }

    /**
     * Relation avec l'utilisateur qui a créé l'indisponibilité
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relation avec l'utilisateur qui a débloqué/annulé l'indisponibilité
     */
    public function canceller()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
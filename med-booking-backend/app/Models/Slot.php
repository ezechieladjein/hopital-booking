<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Slot extends Model
{
    // On autorise Laravel à remplir ces colonnes d'un coup (Mass Assignment)
    protected $fillable = [
        'doctor_id',
        'date_consultation',
        'start_time',
        'end_time',
        'status',
        'reserved_until'
    ];

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class, 'doctor_id');
    }
}
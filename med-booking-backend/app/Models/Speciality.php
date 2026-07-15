<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Speciality extends Model
{
    protected $fillable = ['nom', 'duree_consultation', 'tarif', 'is_active'];

    public function doctors(): HasMany
    {
        return $this->hasMany(Doctor::class, 'speciality_id');
    }
}
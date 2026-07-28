<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'nom',
        'prenom',
        'email',
        'telephone',
        'age',
        'sexe',
        'keycloak_uuid',
        'role',
        'password',
        'keycloak_synced',
        'must_change_password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'keycloak_synced' => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * Créer ou mettre à jour un utilisateur depuis Keycloak
     */
    public static function syncFromKeycloak($keycloakPayload)
    {
        $keycloakId = $keycloakPayload['sub'] ?? null;
        
        if (!$keycloakId) {
            return null;
        }

        // Récupérer les informations du payload
        $email = $keycloakPayload['email'] ?? null;
        $nom = $keycloakPayload['family_name'] ?? $keycloakPayload['name'] ?? 'Nom';
        $prenom = $keycloakPayload['given_name'] ?? 'Prénom';
        
        // Déterminer le rôle
        $roles = $keycloakPayload['realm_access']['roles'] ?? ['patient'];
        $role = 'patient';
        if (in_array('admin', $roles)) $role = 'administrateur';
        elseif (in_array('secretary', $roles) || in_array('secretaire', $roles)) $role = 'secretaire';

        // Chercher l'utilisateur
        $user = self::where('keycloak_uuid', $keycloakId)->first();

        if ($user) {
            // Mettre à jour
            $user->update([
                'email' => $email ?? $user->email,
                'nom' => $nom,
                'prenom' => $prenom,
                'role' => $role,
                'keycloak_synced' => true,
            ]);
            return $user;
        }

        // Créer un nouvel utilisateur
        return self::create([
            'keycloak_uuid' => $keycloakId,
            'email' => $email ?? 'no-email@example.com',
            'nom' => $nom,
            'prenom' => $prenom,
            'role' => $role,
            'password' => Hash::make('temporary-' . uniqid()),
            'keycloak_synced' => true,
            'must_change_password' => false,
        ]);
    }
}
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
            'email_verified_at'    => 'datetime',
            'password'             => 'hashed',
            'keycloak_synced'      => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * Créer ou mettre à jour un utilisateur depuis Keycloak avec mapping de rôles robuste
     */
    public static function syncFromKeycloak(array $keycloakPayload): ?self
    {
        $keycloakId = $keycloakPayload['sub'] ?? null;
        
        if (!$keycloakId) {
            return null;
        }

        // Extraction des informations basiques
        $email  = $keycloakPayload['email'] ?? null;
        $nom    = $keycloakPayload['family_name'] ?? $keycloakPayload['name'] ?? 'Nom';
        $prenom = $keycloakPayload['given_name'] ?? 'Prénom';

        // 1. Extraire tous les rôles (Realm + Client) et tout normaliser en minuscules
        $realmRoles  = $keycloakPayload['realm_access']['roles'] ?? [];
        $clientRoles = array_merge(...array_column($keycloakPayload['resource_access'] ?? [], 'roles'));
        $allRoles    = array_map('strtolower', array_merge($realmRoles, $clientRoles));

        // 2. Mapping Keycloak ('admin', 'secretary', 'patient') -> ENUM MySQL ('administrateur', 'secretaire', 'patient')
        $role = 'patient';

        if (in_array('admin', $allRoles) || in_array('administrateur', $allRoles)) {
            $role = 'administrateur';
        } elseif (in_array('secretary', $allRoles) || in_array('secretaire', $allRoles)) {
            $role = 'secretaire';
        }

        // 3. Recherche de l'utilisateur par UUID Keycloak ou par Email
        $user = self::where('keycloak_uuid', $keycloakId)
            ->orWhere(function ($query) use ($email) {
                if ($email) {
                    $query->where('email', $email);
                }
            })
            ->first();

        // 4. Mise à jour de l'utilisateur existant
        if ($user) {
            $user->update([
                'keycloak_uuid'   => $keycloakId,
                'email'           => $email ?? $user->email,
                'nom'             => $nom,
                'prenom'          => $prenom,
                'role'            => $role,
                'keycloak_synced' => true,
            ]);

            return $user;
        }

        // 5. Création s'il n'existe pas
        return self::create([
            'keycloak_uuid'        => $keycloakId,
            'email'                => $email ?? 'no-email@example.com',
            'nom'                  => $nom,
            'prenom'               => $prenom,
            'role'                 => $role,
            'password'             => Hash::make('temporary-' . uniqid()),
            'keycloak_synced'      => true,
            'must_change_password' => false,
        ]);
    }
}
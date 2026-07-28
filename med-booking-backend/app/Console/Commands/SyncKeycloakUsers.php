<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Hash;

class SyncKeycloakUsers extends Command
{
    protected $signature = 'keycloak:sync-users';
    protected $description = 'Synchroniser les utilisateurs Keycloak avec la base de données locale';

    public function handle()
    {
        $this->info('🔄 Début de la synchronisation des utilisateurs Keycloak...');

        try {
            // 1. Récupérer le token admin
            $adminToken = $this->getAdminToken();
            
            // 2. Récupérer tous les utilisateurs Keycloak
            $keycloakUsers = $this->getKeycloakUsers($adminToken);
            
            $this->info("📋 {$keycloakUsers['count']} utilisateurs trouvés dans Keycloak");

            $created = 0;
            $updated = 0;
            $skipped = 0;

            foreach ($keycloakUsers['users'] as $keycloakUser) {
                // Vérifier si l'utilisateur existe déjà
                $user = User::where('keycloak_id', $keycloakUser['id'])->first();
                
                if ($user) {
                    // Mettre à jour les informations
                    $user->update([
                        'name' => $keycloakUser['firstName'] . ' ' . $keycloakUser['lastName'],
                        'email' => $keycloakUser['email'],
                    ]);
                    $updated++;
                } else {
                    // Vérifier si l'email existe déjà (sans keycloak_id)
                    $existingUser = User::where('email', $keycloakUser['email'])->first();
                    
                    if ($existingUser) {
                        // Mettre à jour le keycloak_id
                        $existingUser->update(['keycloak_id' => $keycloakUser['id']]);
                        $updated++;
                    } else {
                        // Créer un nouvel utilisateur
                        User::create([
                            'keycloak_id' => $keycloakUser['id'],
                            'name' => ($keycloakUser['firstName'] ?? '') . ' ' . ($keycloakUser['lastName'] ?? ''),
                            'email' => $keycloakUser['email'] ?? 'no-email@example.com',
                            'password' => Hash::make('temporary-password-' . uniqid()),
                            'role' => $this->getUserRole($keycloakUser['id'], $adminToken),
                        ]);
                        $created++;
                    }
                }
            }

            $this->info("✅ Synchronisation terminée :");
            $this->info("   - {$created} utilisateurs créés");
            $this->info("   - {$updated} utilisateurs mis à jour");
            $this->info("   - {$skipped} utilisateurs ignorés");

        } catch (\Exception $e) {
            $this->error("❌ Erreur lors de la synchronisation : " . $e->getMessage());
            $this->error($e->getTraceAsString());
        }
    }

    private function getAdminToken()
    {
        $client = new Client();
        $url = env('KEYCLOAK_BASE_URL') . '/realms/' . env('KEYCLOAK_REALM') . '/protocol/openid-connect/token';
        
        $response = $client->post($url, [
            'form_params' => [
                'client_id' => env('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
                'client_secret' => env('KEYCLOAK_ADMIN_CLIENT_SECRET'),
                'grant_type' => 'client_credentials',
            ]
        ]);

        $data = json_decode($response->getBody(), true);
        return $data['access_token'];
    }

    private function getKeycloakUsers($token)
    {
        $client = new Client();
        $url = env('KEYCLOAK_BASE_URL') . '/admin/realms/' . env('KEYCLOAK_REALM') . '/users?max=1000';
        
        $response = $client->get($url, [
            'headers' => ['Authorization' => 'Bearer ' . $token]
        ]);

        $users = json_decode($response->getBody(), true);
        
        return [
            'count' => count($users),
            'users' => $users
        ];
    }

    private function getUserRole($userId, $token)
    {
        try {
            $client = new Client();
            $url = env('KEYCLOAK_BASE_URL') . '/admin/realms/' . env('KEYCLOAK_REALM') . '/users/' . $userId . '/role-mappings/realm';
            
            $response = $client->get($url, [
                'headers' => ['Authorization' => 'Bearer ' . $token]
            ]);

            $roles = json_decode($response->getBody(), true);
            
            // Déterminer le rôle principal
            foreach ($roles as $role) {
                if ($role['name'] === 'admin') return 'admin';
                if ($role['name'] === 'secretary') return 'secretary';
                if ($role['name'] === 'patient') return 'patient';
            }
            
            return 'patient'; // Rôle par défaut
        } catch (\Exception $e) {
            return 'patient';
        }
    }
}
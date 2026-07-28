<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    /**
     * Inscription d'un nouveau patient
     */
    public function registerPatient(Request $request)
    {
        Log::info('🚀 [registerPatient] Début de l\'inscription');

        try {
            $validated = $request->validate([
                'nom' => 'required|string|max:100',
                'prenom' => 'required|string|max:100',
                'email' => 'required|email|max:150|unique:users,email',
                'telephone' => 'nullable|string|max:30',
                'password' => 'required|string|min:8|confirmed',
                'age' => 'nullable|integer|min:0|max:120',
                'sexe' => 'nullable|in:M,F',
            ]);

            Log::info('✅ [registerPatient] Validation OK pour: ' . $validated['email']);

            // 1. Vérifier si l'utilisateur existe déjà dans Keycloak
            $keycloakId = $this->findOrCreateKeycloakUser($validated);
            
            if (!$keycloakId) {
                Log::error('❌ [registerPatient] Échec Keycloak');
                return response()->json([
                    'success' => false,
                    'message' => 'Erreur lors de la création du compte Keycloak'
                ], 500);
            }

            // 2. Créer l'utilisateur en base locale
            $user = User::create([
                'keycloak_uuid' => $keycloakId,
                'nom' => $validated['nom'],
                'prenom' => $validated['prenom'],
                'email' => $validated['email'],
                'telephone' => $validated['telephone'] ?? null,
                'age' => $validated['age'] ?? null,
                'sexe' => $validated['sexe'] ?? null,
                'role' => 'patient',
                'password' => Hash::make($validated['password']),
                'keycloak_synced' => true,
                'must_change_password' => false,
            ]);

            Log::info('✅ [registerPatient] Utilisateur créé en base avec ID: ' . $user->id);

            return response()->json([
                'success' => true,
                'message' => 'Inscription réussie !',
                'user' => [
                    'id' => $user->id,
                    'nom' => $user->nom,
                    'prenom' => $user->prenom,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
                'keycloak_id' => $keycloakId,
            ], 201);

        } catch (\Exception $e) {
            Log::error('❌ [registerPatient] Erreur: ' . $e->getMessage());
            Log::error('📚 Stack: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Erreur: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Trouver ou créer un utilisateur dans Keycloak
     */
    private function findOrCreateKeycloakUser($data)
    {
        try {
            // 1. Récupérer le token admin (via le compte admin, pas admin-cli)
            $adminToken = $this->getAdminToken();
            
            if (!$adminToken) {
                Log::error('❌ [findOrCreateKeycloakUser] Token admin null');
                return null;
            }

            $baseUrl = config('keycloak.base_url');
            $realm = config('keycloak.realm');

            // 2. Vérifier si l'utilisateur existe déjà
            Log::info('🔍 [findOrCreateKeycloakUser] Recherche: ' . $data['email']);
            $checkResponse = Http::withToken($adminToken)->get($baseUrl . '/admin/realms/' . $realm . "/users", [
                'email' => $data['email']
            ]);

            if ($checkResponse->successful()) {
                $existingUsers = $checkResponse->json();
                if (count($existingUsers) > 0) {
                    Log::info('✅ [findOrCreateKeycloakUser] Utilisateur existe déjà: ' . $existingUsers[0]['id']);
                    return $existingUsers[0]['id'];
                }
            }

            // 3. Créer l'utilisateur
            Log::info('👤 [findOrCreateKeycloakUser] Création...');
            $createResponse = Http::withToken($adminToken)->post($baseUrl . '/admin/realms/' . $realm . "/users", [
                'username' => $data['email'],
                'email' => $data['email'],
                'firstName' => $data['prenom'],
                'lastName' => $data['nom'],
                'enabled' => true,
                'emailVerified' => true,
                'credentials' => [
                    [
                        'type' => 'password',
                        'value' => $data['password'],
                        'temporary' => false,
                    ]
                ],
            ]);

            Log::info('📤 [findOrCreateKeycloakUser] Status: ' . $createResponse->status());
            Log::info('📤 [findOrCreateKeycloakUser] Body: ' . $createResponse->body());

            if (!$createResponse->successful()) {
                Log::error('❌ [findOrCreateKeycloakUser] Échec: ' . $createResponse->body());
                return null;
            }

            $locationHeader = $createResponse->header('Location');
            $userId = last(explode('/', $locationHeader));
            Log::info('✅ [findOrCreateKeycloakUser] Créé avec ID: ' . $userId);

            return $userId;

        } catch (\Exception $e) {
            Log::error('❌ [findOrCreateKeycloakUser] Exception: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Récupérer un token admin avec le compte admin
     */
    private function getAdminToken()
    {
        try {
            $baseUrl = config('keycloak.base_url');
            
            // ⚠️ Utiliser le realm MASTER avec le compte ADMIN
            $url = $baseUrl . '/realms/master/protocol/openid-connect/token';
            
            Log::info('🔑 [getAdminToken] URL: ' . $url);
            
            $response = Http::asForm()->post($url, [
                'client_id' => 'admin-cli',
                'username' => 'admin',
                'password' => 'AdminPassword123*',
                'grant_type' => 'password',
            ]);

            Log::info('📤 [getAdminToken] Status: ' . $response->status());

            if (!$response->successful()) {
                Log::error('❌ [getAdminToken] Échec: ' . $response->body());
                return null;
            }

            $data = $response->json();
            
            if (!isset($data['access_token'])) {
                Log::error('❌ [getAdminToken] Pas de token');
                return null;
            }

            Log::info('✅ [getAdminToken] Token obtenu');
            return $data['access_token'];

        } catch (\Exception $e) {
            Log::error('❌ [getAdminToken] Exception: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Connexion (retourne les informations de l'utilisateur)
     */
    public function me(Request $request)
    {
        $user = $request->attributes->get('user');
        
        if (!$user) {
            return response()->json(['message' => 'Utilisateur non trouvé'], 404);
        }

        return response()->json([
            'success' => true,
            'user' => $user,
            'must_change_password' => $user->must_change_password ?? false,
        ]);
    }
}
<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class PasswordController extends Controller
{
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        try {
            // Récupérer l'utilisateur connecté
            $user = $request->attributes->get('user');
            
            if (!$user) {
                return response()->json(['message' => 'Utilisateur non trouvé'], 404);
            }

            // Vérifier le mot de passe actuel dans Keycloak
            $tokenResponse = Http::asForm()->post(env('KEYCLOAK_BASE_URL') . '/realms/' . env('KEYCLOAK_REALM') . '/protocol/openid-connect/token', [
                'client_id' => env('KEYCLOAK_CLIENT_ID'),
                'client_secret' => env('KEYCLOAK_CLIENT_SECRET'),
                'username' => $user->email,
                'password' => $request->current_password,
                'grant_type' => 'password',
            ]);

            if (!$tokenResponse->successful()) {
                return response()->json([
                    'message' => 'Le mot de passe actuel est incorrect.'
                ], 401);
            }

            // Changer le mot de passe dans Keycloak
            $adminToken = $this->getAdminToken();
            $baseUrl = env('KEYCLOAK_BASE_URL') . '/admin/realms/' . env('KEYCLOAK_REALM');
            
            $resetResponse = Http::withToken($adminToken)->put($baseUrl . "/users/{$user->keycloak_uuid}/reset-password", [
                'type' => 'password',
                'value' => $request->new_password,
                'temporary' => false,
            ]);

            if (!$resetResponse->successful()) {
                return response()->json([
                    'message' => 'Erreur lors du changement de mot de passe Keycloak.'
                ], 500);
            }

            // Mettre à jour le flag dans la base locale
            $user->update([
                'password' => Hash::make($request->new_password),
                'must_change_password' => false,
            ]);

            return response()->json([
                'message' => 'Mot de passe changé avec succès !',
                'must_change_password' => false,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage()
            ], 500);
        }
    }

    private function getAdminToken()
    {
        $tokenResponse = Http::asForm()->post(env('KEYCLOAK_BASE_URL') . '/realms/' . env('KEYCLOAK_REALM') . '/protocol/openid-connect/token', [
            'client_id' => 'admin-cli',
            'client_secret' => env('KEYCLOAK_ADMIN_CLIENT_SECRET'),
            'grant_type' => 'client_credentials',
        ]);

        return $tokenResponse->json()['access_token'];
    }
}
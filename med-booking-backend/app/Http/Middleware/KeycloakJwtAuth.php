<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User;
use Symfony\Component\HttpFoundation\Response;

class KeycloakJwtAuth
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Token d\'authentification manquant.'], 401);
        }

        // Décodage du jeton JWT (Header.Payload.Signature)
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            return response()->json(['message' => 'Token invalide.'], 401);
        }

        $payload = json_decode(base64_decode($tokenParts[1]), true);

        // Vérification de l'expiration du token
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return response()->json(['message' => 'Token expiré.'], 401);
        }

        // 🔥 SYNC AUTOMATIQUE : Créer ou mettre à jour l'utilisateur en base
        $user = User::syncFromKeycloak($payload);
        
        if (!$user) {
            return response()->json(['message' => 'Impossible de synchroniser l\'utilisateur.'], 401);
        }

        // Vérification des rôles si spécifiés dans le middleware
        if (!empty($roles)) {
            $userRoles = $payload['realm_access']['roles'] ?? [];
            $hasRole = false;

            foreach ($roles as $role) {
                if (in_array($role, $userRoles)) {
                    $hasRole = true;
                    break;
                }
            }

            if (!$hasRole) {
                return response()->json(['message' => 'Accès non autorisé pour ce rôle.'], 403);
            }
        }

        // Attacher les données de l'utilisateur à la requête
        $request->attributes->set('keycloak_user', $payload);
        $request->attributes->set('user', $user);

        return $next($request);
    }
}
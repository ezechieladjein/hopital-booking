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

        // 1. Découpage du jeton JWT
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            return response()->json(['message' => 'Token invalide.'], 401);
        }

        // 2. Décodage sécurisé de la partie Payload (Format Base64URL)
        $base64UrlPayload = $tokenParts[1];
        $base64Payload    = str_replace(['-', '_'], ['+', '/'], $base64UrlPayload);
        $payload          = json_decode(base64_decode($base64Payload), true);

        if (!$payload) {
            return response()->json(['message' => 'Impossible de décoder le payload JWT.'], 401);
        }

        // 3. Vérification de l'expiration du token
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return response()->json(['message' => 'Token expiré.'], 401);
        }

        // 4. Synchronisation automatique avec la BDD
        $user = User::syncFromKeycloak($payload);

        if (!$user) {
            return response()->json(['message' => 'Impossible de synchroniser l\'utilisateur.'], 401);
        }

        // 5. Vérification des rôles requis par la route
        if (!empty($roles)) {
            $realmRoles  = $payload['realm_access']['roles'] ?? [];
            $clientRoles = array_merge(...array_column($payload['resource_access'] ?? [], 'roles'));
            $userRoles   = array_map('strtolower', array_merge($realmRoles, $clientRoles));

            $hasRole = false;
            foreach ($roles as $role) {
                $targetRole = strtolower($role);
                // Prise en charge des équivalences FR/EN pour la protection de la route
                if (in_array($targetRole, $userRoles) || 
                   ($targetRole === 'admin' && in_array('administrateur', $userRoles)) ||
                   ($targetRole === 'secretary' && in_array('secretaire', $userRoles))) {
                    $hasRole = true;
                    break;
                }
            }

            if (!$hasRole) {
                return response()->json(['message' => 'Accès non autorisé pour ce rôle.'], 403);
            }
        }

        // 6. Attacher l'utilisateur à l'authentification native Laravel ($request->user())
        $request->setUserResolver(function () use ($user) {
            return $user;
        });

        $request->attributes->set('keycloak_user', $payload);
        $request->attributes->set('user', $user);
        
        // AJOUT : Attacher l'utilisateur à l'instance auth pour auth()->id()
        auth()->setUser($user);

        return $next($request);
    }
}
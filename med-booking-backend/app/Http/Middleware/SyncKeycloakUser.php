<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SyncKeycloakUser
{
    public function handle(Request $request, Closure $next)
    {
        if (auth()->check()) {
            $user = auth()->user();
            
            // Si l'utilisateur a un keycloak_id mais n'existe pas dans la base locale
            if ($user && !$user->keycloak_synced) {
                $this->syncUserFromKeycloak($user);
            }
        }

        return $next($request);
    }

    private function syncUserFromKeycloak($user)
    {
        // Récupérer les informations depuis Keycloak
        // et mettre à jour la base locale
        $user->keycloak_synced = true;
        $user->save();
    }
}
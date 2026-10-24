<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Réserve une route au Super-administrateur de la plateforme : compte rattaché à aucune
// entreprise et portant le rôle global « Super-administrateur ».
class VerifierSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $utilisateur = $request->user();
        $role = $utilisateur?->role;

        $autorise = $utilisateur
            && $utilisateur->entreprise_id === null
            && $role
            && $role->entreprise_id === null
            && $role->nom_role === 'Super-administrateur';

        if (! $autorise) {
            return response()->json(['message' => 'Action réservée au super-administrateur.'], 403);
        }

        return $next($request);
    }
}

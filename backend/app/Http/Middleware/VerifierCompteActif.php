<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifierCompteActif
{
    public function handle(Request $request, Closure $next): Response
    {
        $utilisateur = $request->user();

        if ($utilisateur && $utilisateur->statut_compte !== 'actif') {
            return response()->json(['message' => 'Compte désactivé.'], 403);
        }

        // Entreprise, rôle et permissions sont chargés ici une seule fois par requête ; les middlewares
        // de permission et les contrôleurs réutilisent ces relations au lieu de les redemander à la base.
        $utilisateur?->loadMissing(['entreprise', 'role.permissions']);

        if ($utilisateur?->entreprise_id && $utilisateur->entreprise?->statut_entreprise !== 'active') {
            return response()->json(['message' => 'Entreprise suspendue.'], 403);
        }

        return $next($request);
    }
}

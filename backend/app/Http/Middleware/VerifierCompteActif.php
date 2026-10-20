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

        return $next($request);
    }
}
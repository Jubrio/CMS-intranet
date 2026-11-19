<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifierPermission
{
    public function handle(Request $request, Closure $next, string $code): Response
    {
        $utilisateur = $request->user();

        // Relations déjà chargées par « compte.actif » : aucune requête supplémentaire par permission vérifiée
        $utilisateur?->loadMissing('role.permissions');
        $autorise = (bool) $utilisateur?->role?->permissions->contains('code_permission', $code);

        if (! $autorise) {
            return response()->json(['message' => 'Action non autorisée pour votre rôle.'], 403);
        }

        return $next($request);
    }
}

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
        $autorise = $utilisateur
            && $utilisateur->role->permissions()->where('code_permission', $code)->exists();

        if (! $autorise) {
            return response()->json(['message' => 'Action non autorisée pour votre rôle.'], 403);
        }

        return $next($request);
    }
}

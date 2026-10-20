<?php
namespace App\Http\Middleware;

use App\Models\ModuleEntreprise;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifierModule
{
    public function handle(Request $request, Closure $next, string $code): Response
    {
        $entrepriseId = $request->user()?->entreprise_id;

        $actif = $entrepriseId && ModuleEntreprise::where('entreprise_id', $entrepriseId)
            ->where('module_actif', true)
            ->whereHas('module', fn ($q) => $q->where('code_module', $code))
            ->exists();

        if (! $actif) {
            return response()->json(['message' => 'Module désactivé.'], 403); // RG10
        }
        return $next($request);
    }
}
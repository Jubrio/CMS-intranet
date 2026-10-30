<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use App\Models\Utilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        // Limitation par couple e-mail + IP, en plus du throttle par IP de la route
        $cle = 'login:'.mb_strtolower((string) $request->email).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($cle, 5)) {
            return response()->json([
                'message' => 'Trop de tentatives. Réessayez dans '.RateLimiter::availableIn($cle).' secondes.',
            ], 429);
        }

        $utilisateur = Utilisateur::with(['role.permissions', 'entreprise'])
            ->where('email', $request->email)
            ->first();

        // Hash::check est toujours exécuté (hash factice si le compte n'existe pas) :
        // le temps de réponse ne révèle pas si l'e-mail existe.
        $hashFactice = '$2y$12$J3bPZ4GK1B9TL4lHlDGY0.gL85q7Q5tcxFTclvWpJIdB4ggMa4n.K';
        $motDePasseOk = Hash::check($request->mot_de_passe, $utilisateur?->mot_de_passe ?? $hashFactice);

        if (! $utilisateur || ! $motDePasseOk) {
            RateLimiter::hit($cle, 60);

            return response()->json(['message' => 'Identifiants incorrects.'], 401);
        }
        RateLimiter::clear($cle);
        if ($utilisateur->statut_compte !== 'actif') {
            return response()->json(['message' => 'Compte désactivé.'], 403);
        }
        if ($utilisateur->entreprise && $utilisateur->entreprise->statut_entreprise !== 'active') {
            return response()->json(['message' => 'Entreprise suspendue.'], 403);
        }

        return response()->json([
            'token' => $utilisateur->createToken('intranet')->plainTextToken,
            'utilisateur' => $this->profil($utilisateur),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }

    public function moi(Request $request): JsonResponse
    {
        return response()->json($this->profil($request->user()->load(['role.permissions', 'entreprise'])));
    }

    public function profil(Utilisateur $u): array
    {
        $modules = $u->entreprise_id
            ? Module::whereIn('id', ModuleEntreprise::where('entreprise_id', $u->entreprise_id)
                ->where('module_actif', true)->pluck('module_id'))->pluck('code_module')
            : collect();

        return [
            'id' => $u->id,
            'nom' => $u->nom,
            'prenom' => $u->prenom,
            'email' => $u->email,
            'role' => $u->role->nom_role,
            'departement_id' => $u->departement_id,
            'telephone' => $u->telephone,
            'poste' => $u->poste,
            'photo' => \App\Services\FichiersProfil::url($u->photo),
            'entreprise' => $u->entreprise?->nom_entreprise,
            'permissions' => $u->role->permissions->pluck('code_permission'),
            'modules_actifs' => $modules,
        ];
    }
}

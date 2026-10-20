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

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $utilisateur = Utilisateur::with(['role.permissions', 'entreprise'])
            ->where('email', $request->email)
            ->first();

        if (! $utilisateur || ! Hash::check($request->mot_de_passe, $utilisateur->mot_de_passe)) {
            return response()->json(['message' => 'Identifiants incorrects.'], 401);
        }
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

    private function profil(Utilisateur $u): array
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
            'entreprise' => $u->entreprise?->nom_entreprise,
            'permissions' => $u->role->permissions->pluck('code_permission'),
            'modules_actifs' => $modules,
        ];
    }
}
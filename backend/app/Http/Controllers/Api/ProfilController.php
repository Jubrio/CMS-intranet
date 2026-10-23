<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

// Profil de la personne connectée : chacun gère ses propres informations, sans permission particulière.
// Le rôle, le département, le poste et l'e-mail restent réservés aux gestionnaires (écrans Utilisateurs et Annuaire).
class ProfilController extends Controller
{
    public function modifier(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'prenom' => 'sometimes|string|max:60',
            'nom' => 'sometimes|string|max:50',
            'telephone' => 'sometimes|nullable|string|max:20',
        ]);
        if (empty($donnees)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        $utilisateur = $request->user();
        $utilisateur->forceFill($donnees)->save();

        return response()->json($this->profil($utilisateur));
    }

    public function photo(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048', // RG25
        ]);

        $utilisateur = $request->user();
        if ($utilisateur->photo) {
            Storage::disk('public')->delete($utilisateur->photo);
        }
        $utilisateur->forceFill(['photo' => $request->file('photo')->store('photos', 'public')])->save();

        return response()->json($this->profil($utilisateur));
    }

    public function motDePasse(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'mot_de_passe_actuel' => ['required', 'string'],
            'nouveau_mot_de_passe' => ['required', 'string', 'min:8', 'max:72', 'confirmed', 'different:mot_de_passe_actuel'],
        ], [
            'nouveau_mot_de_passe.different' => 'Le nouveau mot de passe doit être différent de l’actuel.',
        ]);

        $utilisateur = $request->user();
        if (! Hash::check($donnees['mot_de_passe_actuel'], $utilisateur->mot_de_passe)) {
            return response()->json([
                'message' => 'Le mot de passe actuel est incorrect.',
                'errors' => ['mot_de_passe_actuel' => ['Le mot de passe actuel est incorrect.']],
            ], 422);
        }

        $utilisateur->forceFill(['mot_de_passe' => $donnees['nouveau_mot_de_passe']])->save();
        // Les autres appareils doivent se reconnecter ; la session en cours reste ouverte
        $utilisateur->tokens()->where('id', '!=', $utilisateur->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Mot de passe modifié.']);
    }

    private function profil($utilisateur): array
    {
        return app(AuthController::class)->profil($utilisateur->load(['role.permissions', 'entreprise']));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Utilisateur;
use App\Services\CodesVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

// Codes à 6 chiffres par e-mail : vérification avant création d'intranet, et mot de passe oublié.
// Les réponses sont identiques que l'adresse existe ou non (pas d'énumération de comptes).
class CodesVerificationController extends Controller
{
    private const MESSAGE_ENVOI = 'Si cette adresse peut être utilisée, un code à 6 chiffres vient de lui être envoyé. Pensez à vérifier les courriers indésirables.';

    private const CODE_INVALIDE = 'Code invalide ou expiré.';

    public function __construct(private CodesVerification $codes) {}

    // Inscription, étape 1 : envoi du code
    public function envoyerInscription(Request $request): JsonResponse
    {
        $donnees = $request->validate(['email' => $this->regleEmail()]);

        // Une adresse déjà utilisée ne reçoit rien, mais la réponse reste la même
        if (! Utilisateur::where('email', $donnees['email'])->exists()) {
            $this->codes->envoyer($donnees['email'], CodesVerification::INSCRIPTION);
        }

        return response()->json(['message' => self::MESSAGE_ENVOI]);
    }

    // Inscription, étape 2 : le code donne un jeton, à renvoyer lors de la création de l'intranet
    public function confirmerInscription(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'email' => $this->regleEmail(),
            'code' => ['required', 'digits:6'],
        ]);

        $jeton = $this->codes->confirmerInscription($donnees['email'], $donnees['code']);
        if (! $jeton) {
            return $this->refus('code');
        }

        return response()->json(['jeton_verification' => $jeton]);
    }

    // Mot de passe oublié, étape 1 : envoi du code (uniquement si un compte actif existe)
    public function oublie(Request $request): JsonResponse
    {
        $donnees = $request->validate(['email' => $this->regleEmail(dns: false)]);

        if (Utilisateur::where('email', $donnees['email'])->where('statut_compte', 'actif')->exists()) {
            $this->codes->envoyer($donnees['email'], CodesVerification::MOT_DE_PASSE);
        }

        return response()->json(['message' => self::MESSAGE_ENVOI]);
    }

    // Mot de passe oublié, étape 2 : code + nouveau mot de passe
    public function reinitialiser(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'email' => $this->regleEmail(dns: false),
            'code' => ['required', 'digits:6'],
            'mot_de_passe' => ['required', 'string', 'max:72', 'confirmed',
                Password::default()],
        ]);

        $utilisateur = Utilisateur::where('email', $donnees['email'])->where('statut_compte', 'actif')->first();
        // Le code est vérifié même sans compte, pour garder le même comportement dans les deux cas
        $codeOk = $this->codes->consommerCode($donnees['email'], CodesVerification::MOT_DE_PASSE, $donnees['code']);
        if (! $utilisateur || ! $codeOk) {
            return $this->refus('code');
        }

        $utilisateur->forceFill(['mot_de_passe' => $donnees['mot_de_passe']])->save();
        $utilisateur->tokens()->delete(); // toutes les sessions ouvertes sont fermées

        return response()->json(['message' => 'Mot de passe modifié. Vous pouvez vous connecter.']);
    }

    private function refus(string $champ): JsonResponse
    {
        return response()->json([
            'message' => self::CODE_INVALIDE,
            'errors' => [$champ => [self::CODE_INVALIDE]],
        ], 422);
    }

    // En production, le domaine de l'adresse doit exister (enregistrement MX/A) : écarte les fausses adresses
    private function regleEmail(bool $dns = true): array
    {
        return ['required', 'string', 'max:100', ($dns && app()->isProduction()) ? 'email:rfc,dns' : 'email'];
    }
}

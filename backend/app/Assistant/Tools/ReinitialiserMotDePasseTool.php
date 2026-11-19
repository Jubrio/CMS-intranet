<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ReinitialiserMotDePasseTool implements ToolInterface
{
    use OutilsOrganisation;

    public function __construct(private DroitsUtilisateurs $droits) {}

    public function name(): string
    {
        return 'reinitialiser_mot_de_passe';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Génère un nouveau mot de passe temporaire pour un utilisateur (mot de passe oublié). "
                    ."Le mot de passe est créé automatiquement et n'est montré qu'à l'administrateur : ne jamais le demander ni l'inventer.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'email' => ['type' => 'string', 'description' => 'E-mail du compte, ou son nom complet (prénom nom) si l\'e-mail n\'est pas connu. Ne jamais inventer d\'adresse.'],
                    ],
                    'required' => ['email'],
                ],
            ],
        ];
    }

    public function requiresConfirmation(): bool
    {
        return true;
    }

    public function authorize(Utilisateur $utilisateur): bool
    {
        return $this->aPermission($utilisateur, 'utilisateurs.gerer');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($params, ['email' => ['required', 'string', 'max:255']]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $cible = $this->trouverUtilisateur($utilisateur, $params['email']);

        if ($cible->id === $utilisateur->id) {
            throw new ToolException('Pour votre propre compte, utilisez la page Profil.');
        }
        if (! $this->droits->peutModifierIdentifiants($utilisateur, $cible)) {
            throw new ToolException('Vous ne pouvez pas modifier le mot de passe d\'un compte de niveau égal ou supérieur au vôtre.');
        }

        return ['email' => $cible->email, 'cible' => $this->nomComplet($cible)];
    }

    public function summary(array $params): string
    {
        return "Réinitialiser le mot de passe de {$params['cible']} ({$params['email']}). "
            .'Ses sessions en cours seront fermées et un mot de passe temporaire vous sera affiché une seule fois.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $cible = $this->trouverUtilisateur($utilisateur, $p['email']);

        $motDePasse = Str::password(16);
        $cible->update(['mot_de_passe' => $motDePasse]);
        $cible->tokens()->delete();

        return [
            'message' => 'Le mot de passe de '.$this->nomComplet($cible).' a été réinitialisé.',
            'donnees' => ['id' => $cible->id, 'email' => $cible->email],
            'secret' => ['mot_de_passe_temporaire' => $motDePasse],
        ];
    }
}

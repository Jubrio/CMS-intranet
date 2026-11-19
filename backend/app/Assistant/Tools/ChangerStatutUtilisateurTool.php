<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use Illuminate\Support\Facades\Validator;

class ChangerStatutUtilisateurTool implements ToolInterface
{
    use OutilsOrganisation;

    public function __construct(private DroitsUtilisateurs $droits) {}

    public function name(): string
    {
        return 'changer_statut_utilisateur';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Désactive ou réactive un compte utilisateur (il ne peut plus se connecter quand il est désactivé). "
                    .'Ne supprime jamais le compte.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'email' => ['type' => 'string', 'description' => 'E-mail du compte, ou son nom complet (prénom nom) si l\'e-mail n\'est pas connu. Ne jamais inventer d\'adresse.'],
                        'actif' => ['type' => 'boolean', 'description' => 'true pour réactiver, false pour désactiver'],
                    ],
                    'required' => ['email', 'actif'],
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
        $actif = filter_var($params['actif'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($actif === null) {
            throw new ToolException('Précisez s\'il faut activer ou désactiver le compte.');
        }

        $cible = $this->trouverUtilisateur($utilisateur, $params['email']);
        if (! $this->droits->peutGerer($utilisateur, $cible)) {
            throw new ToolException('Ce compte possède des droits supérieurs aux vôtres.');
        }
        if (! $actif) {
            if ($cible->id === $utilisateur->id) {
                throw new ToolException('Vous ne pouvez pas désactiver votre propre compte.');
            }
            if ($this->droits->estDernierAdminActif($cible)) {
                throw new ToolException('Le dernier administrateur actif ne peut pas être désactivé.');
            }
        }
        if (($cible->statut_compte === 'actif') === $actif) {
            throw new ToolException('Ce compte est déjà '.($actif ? 'actif' : 'désactivé').'.');
        }

        return ['email' => $cible->email, 'actif' => $actif, 'cible' => $this->nomComplet($cible)];
    }

    public function summary(array $params): string
    {
        $verbe = $params['actif'] ? 'Réactiver' : 'Désactiver';

        return "{$verbe} le compte de {$params['cible']} ({$params['email']}).".($params['actif'] ? '' : ' Il sera déconnecté immédiatement.');
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $cible = $this->trouverUtilisateur($utilisateur, $p['email']);

        $cible->statut_compte = $p['actif'] ? 'actif' : 'inactif';
        $cible->save();
        if (! $p['actif']) {
            $cible->tokens()->delete();
        }

        return [
            'message' => 'Le compte de '.$this->nomComplet($cible).($p['actif'] ? ' a été réactivé.' : ' a été désactivé.'),
            'donnees' => ['id' => $cible->id, 'statut_compte' => $cible->statut_compte],
            'secret' => null,
        ];
    }
}

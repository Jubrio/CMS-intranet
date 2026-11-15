<?php

namespace App\Assistant\Tools;

use App\Models\Formulaire;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ChangerStatutFormulaireTool implements ToolInterface
{
    use RechercheParTitre;
    use OutilsModules;

    public function name(): string
    {
        return 'changer_statut_formulaire';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Publie un formulaire en brouillon, ou clôture un formulaire (il n\'accepte alors plus de réponses). Ne supprime jamais. '
                    .'Désigner l\'élément par son titre actuel (titre_actuel), ou son identifiant s\'il est connu.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL de l\'élément visé (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant, seulement s\'il est connu (facultatif)'],
                        'action' => ['type' => 'string', 'enum' => ['publier', 'cloturer'], 'description' => 'publier ou cloturer'],
                    ],
                    'required' => ['action'],
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
        return $this->droitsModules($utilisateur, ['formulaires'], ['formulaires.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:250'],
            'action' => ['required', 'in:publier,cloturer'],
        ], ['action.in' => "L'action doit être publier ou cloturer."]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $formulaire = $this->retrouverParTitre(Formulaire::where('entreprise_id', $utilisateur->entreprise_id), isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null, 'titre_formulaire', 'Aucun formulaire', 'lister_formulaires');
        if ($d['action'] === 'publier') {
            if ($formulaire->statut_formulaire !== 'brouillon') {
                throw new ToolException('Seul un brouillon peut être publié.');
            }
            if ($formulaire->date_limite && $formulaire->date_limite->lt(today())) {
                throw new ToolException('La date limite est dépassée.');
            }
        } elseif ($formulaire->statut_formulaire === 'cloture') {
            throw new ToolException('Ce formulaire est déjà clôturé.');
        }

        return ['id' => $formulaire->id, 'action' => $d['action'], 'formulaire' => $formulaire->titre_formulaire];
    }

    public function summary(array $params): string
    {
        return $params['action'] === 'publier'
            ? "Publier le formulaire « {$params['formulaire']} » : il sera ouvert aux réponses."
            : "Clôturer le formulaire « {$params['formulaire']} » : il n'acceptera plus de réponses.";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $formulaire = Formulaire::where('entreprise_id', $utilisateur->entreprise_id)->findOrFail($p['id']);
        $formulaire->update(['statut_formulaire' => $p['action'] === 'publier' ? 'publie' : 'cloture']);

        return [
            'message' => "Le formulaire « {$formulaire->titre_formulaire} » a été ".($p['action'] === 'publier' ? 'publié.' : 'clôturé.'),
            'donnees' => ['id' => $formulaire->id, 'statut' => $formulaire->statut_formulaire],
            'secret' => null,
        ];
    }
}

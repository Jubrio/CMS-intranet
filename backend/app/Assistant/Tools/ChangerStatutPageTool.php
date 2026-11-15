<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ChangerStatutPageTool implements ToolInterface
{
    use RechercheParTitre;
    use OutilsModules;

    public function name(): string
    {
        return 'changer_statut_page';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Publie une page (brouillon ou archivée) ou archive une page publiée. « Dépublier » signifie archiver. Ne supprime jamais. '
                    .'Désigner l\'élément par son titre actuel (titre_actuel), ou son identifiant s\'il est connu.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL de l\'élément visé (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant, seulement s\'il est connu (facultatif)'],
                        'action' => ['type' => 'string', 'enum' => ['publier', 'archiver'], 'description' => 'publier ou archiver'],
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
        return $this->droitsModules($utilisateur, ['pages'], ['pages.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:250'],
            'action' => ['required', 'in:publier,archiver'],
        ], ['action.in' => "L'action doit être publier ou archiver."]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $page = $this->retrouverParTitre(Contenu::where('entreprise_id', $utilisateur->entreprise_id)->where('type_contenu', 'page'), isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null, 'titre', 'Aucune page', 'lister_pages');
        if ($d['action'] === 'publier' && $page->statut_contenu === 'publie') {
            throw new ToolException('Cette page est déjà publiée.');
        }
        if ($d['action'] === 'archiver' && $page->statut_contenu !== 'publie') {
            throw new ToolException('Seule une page publiée peut être archivée.');
        }

        return ['id' => $page->id, 'action' => $d['action'], 'page' => $page->titre];
    }

    public function summary(array $params): string
    {
        return $params['action'] === 'publier'
            ? "Publier la page « {$params['page']} »."
            : "Archiver la page « {$params['page']} » : elle ne sera plus visible dans l'intranet.";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $page = Contenu::where('entreprise_id', $utilisateur->entreprise_id)->where('type_contenu', 'page')->findOrFail($p['id']);

        if ($p['action'] === 'publier') {
            $page->update(['statut_contenu' => 'publie', 'date_publication' => $page->date_publication ?? now()]);
        } else {
            $page->update(['statut_contenu' => 'archive']);
        }

        return [
            'message' => "La page « {$page->titre} » a été ".($p['action'] === 'publier' ? 'publiée.' : 'archivée.'),
            'donnees' => ['id' => $page->id, 'statut' => $page->statut_contenu],
            'secret' => null,
        ];
    }
}

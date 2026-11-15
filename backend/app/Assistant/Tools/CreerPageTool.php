<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class CreerPageTool implements ToolInterface
{
    use OutilsModules;
    use OutilsPortee;

    public function name(): string
    {
        return 'creer_page';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Crée une page interne (en brouillon par défaut). Le contenu vient uniquement de ce que l\'administrateur a fourni : ne jamais inventer de faits.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre' => ['type' => 'string', 'description' => 'Titre de la page (150 caractères maximum)'],
                        'corps' => ['type' => 'string', 'description' => 'Texte complet de la page'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire ; à omettre pour toute l'entreprise"],
                        'emplacement_menu' => ['type' => 'string', 'description' => 'Emplacement dans le menu (facultatif)'],
                        'publier' => ['type' => 'boolean', 'description' => 'true pour publier tout de suite ; sinon la page reste en brouillon'],
                    ],
                    'required' => ['titre', 'corps'],
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
            'titre' => ['required', 'string', 'max:150'],
            'corps' => ['required', 'string', 'max:100000'],
            'departement' => ['nullable', 'string', 'max:150'],
            'emplacement_menu' => ['nullable', 'string', 'max:50'],
            'publier' => ['nullable', 'boolean'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        [, , $nomDepartement] = $this->resoudreDestinataires($utilisateur, $d['departement'] ?? null);

        return [
            'titre' => trim($d['titre']),
            'corps' => trim($d['corps']),
            'departement' => $nomDepartement === 'aucun' ? null : $nomDepartement,
            'emplacement_menu' => $d['emplacement_menu'] ?? null,
            'publier' => (bool) ($d['publier'] ?? false),
        ];
    }

    public function summary(array $params): string
    {
        $verbe = $params['publier'] ? 'Créer et publier' : 'Créer en brouillon';
        $cible = $params['departement'] ? "pour le département {$params['departement']}" : "pour toute l'entreprise";

        return "{$verbe} la page « {$params['titre']} » {$cible}.\n\n{$params['corps']}";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        [$visibilite, $departementId] = $this->resoudreDestinataires($utilisateur, $p['departement']);

        $page = Contenu::create([
            'entreprise_id' => $utilisateur->entreprise_id,
            'auteur_id' => $utilisateur->id,
            'departement_id' => $departementId,
            'type_contenu' => 'page',
            'titre' => $p['titre'],
            'corps' => $p['corps'],
            'statut_contenu' => $p['publier'] ? 'publie' : 'brouillon',
            'visibilite' => $visibilite,
            'date_publication' => $p['publier'] ? now() : null,
            'emplacement_menu' => $p['emplacement_menu'],
        ]);

        return [
            'message' => "La page « {$page->titre} » a été ".($p['publier'] ? 'publiée.' : 'enregistrée en brouillon.'),
            'donnees' => ['id' => $page->id, 'statut' => $page->statut_contenu],
            'secret' => null,
        ];
    }
}

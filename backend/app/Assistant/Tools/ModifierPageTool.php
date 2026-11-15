<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ModifierPageTool implements ToolInterface
{
    use RechercheParTitre;
    use OutilsModules;
    use OutilsPortee;

    public function name(): string
    {
        return 'modifier_page';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Modifie une page interne (titre, texte, destinataires, emplacement dans le menu). Ne renseigner que les champs à changer. '
                    .'Désigner l\'élément par son titre actuel (titre_actuel), ou son identifiant s\'il est connu. Le texte vient uniquement de ce que l\'administrateur a fourni.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL de l\'élément visé (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant, seulement s\'il est connu (facultatif)'],
                        'titre' => ['type' => 'string', 'description' => 'Nouveau titre'],
                        'corps' => ['type' => 'string', 'description' => 'Nouveau texte complet'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire, ou « aucun » pour toute l'entreprise"],
                        'emplacement_menu' => ['type' => 'string', 'description' => 'Nouvel emplacement dans le menu'],
                    ],
                    'required' => [],
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
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== '' && $v !== []), [
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:250'],
            'titre' => ['nullable', 'string', 'max:150'],
            'corps' => ['nullable', 'string', 'max:100000'],
            'departement' => ['nullable', 'string', 'max:150'],
            'emplacement_menu' => ['nullable', 'string', 'max:50'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $page = $this->retrouverParTitre(Contenu::where('entreprise_id', $utilisateur->entreprise_id)->where('type_contenu', 'page'), isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null, 'titre', 'Aucune page', 'lister_pages');

        $canonique = ['id' => $page->id];
        $changements = [];
        foreach (['titre' => 'titre', 'corps' => 'texte', 'emplacement_menu' => 'emplacement'] as $cle => $libelle) {
            if (isset($d[$cle]) && trim($d[$cle]) !== (string) $page->{$cle}) {
                $canonique[$cle] = trim($d[$cle]);
                $changements[] = $cle === 'corps' ? 'texte remplacé' : "{$libelle} → ".trim($d[$cle]);
            }
        }
        if (isset($d['departement'])) {
            [$visibilite, $departementId, $nom] = $this->resoudreDestinataires($utilisateur, $d['departement']);
            if ($visibilite !== $page->visibilite || $departementId !== $page->departement_id) {
                $changements[] = 'destinataires → '.($visibilite === 'entreprise' ? "toute l'entreprise" : "département {$nom}");
            }
            $canonique['departement'] = $nom;
        }
        if ($changements === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles de la page.');
        }

        return $canonique + ['page' => $page->titre, 'changements' => $changements];
    }

    public function summary(array $params): string
    {
        $phrase = "Modifier la page « {$params['page']} » : ".implode(' ; ', $params['changements']).'.';

        return isset($params['corps']) ? $phrase."\n\n".$params['corps'] : $phrase;
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $page = Contenu::where('entreprise_id', $utilisateur->entreprise_id)->where('type_contenu', 'page')->findOrFail($p['id']);

        $colonnes = array_intersect_key($p, array_flip(['titre', 'corps', 'emplacement_menu']));
        if (isset($p['departement'])) {
            [$visibilite, $departementId] = $this->resoudreDestinataires($utilisateur, $p['departement']);
            $colonnes += ['visibilite' => $visibilite, 'departement_id' => $departementId];
        }
        $page->update($colonnes);

        return [
            'message' => "La page « {$page->titre} » a été modifiée.",
            'donnees' => ['id' => $page->id, 'changements' => $p['changements']],
            'secret' => null,
        ];
    }
}

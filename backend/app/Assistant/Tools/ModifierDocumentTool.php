<?php

namespace App\Assistant\Tools;

use App\Models\Document;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ModifierDocumentTool implements ToolInterface
{
    use RechercheParTitre;
    use OutilsModules;
    use OutilsPortee;

    public function name(): string
    {
        return 'modifier_document';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Modifie les informations d'un document existant (nom, catégorie, destinataires). Ne change pas le fichier. "
                    .'Ne renseigner que les champs à changer. Désigner l\'élément par son titre actuel (titre_actuel), ou son identifiant s\'il est connu.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL de l\'élément visé (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant, seulement s\'il est connu (facultatif)'],
                        'nom' => ['type' => 'string', 'description' => 'Nouveau nom'],
                        'categorie' => ['type' => 'string', 'description' => 'Nouvelle catégorie'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire, ou « aucun » pour toute l'entreprise"],
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
        return $this->droitsModules($utilisateur, ['documents'], ['documents.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== '' && $v !== []), [
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:250'],
            'nom' => ['nullable', 'string', 'max:150'],
            'categorie' => ['nullable', 'string', 'max:50'],
            'departement' => ['nullable', 'string', 'max:150'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $document = $this->retrouverParTitre(Document::where('entreprise_id', $utilisateur->entreprise_id), isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null, 'nom_document', 'Aucun document', 'lister_documents');
        $this->verifierPorteeManager($utilisateur, $document->visibilite, $document->departement_id, 'documents');

        $canonique = ['id' => $document->id];
        $changements = [];
        foreach (['nom' => ['nom_document', 'nom'], 'categorie' => ['categorie', 'catégorie']] as $cle => [$colonne, $libelle]) {
            if (isset($d[$cle]) && trim($d[$cle]) !== $document->{$colonne}) {
                $canonique[$cle] = trim($d[$cle]);
                $changements[] = "{$libelle} → ".trim($d[$cle]);
            }
        }
        if (isset($d['departement'])) {
            [$visibilite, $departementId, $nom] = $this->resoudreDestinataires($utilisateur, $d['departement']);
            $this->verifierPorteeManager($utilisateur, $visibilite, $departementId, 'documents');
            if ($visibilite !== $document->visibilite || $departementId !== $document->departement_id) {
                $changements[] = 'destinataires → '.($visibilite === 'entreprise' ? "toute l'entreprise" : "département {$nom}");
            }
            $canonique['departement'] = $nom;
        }
        if ($changements === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles du document.');
        }

        return $canonique + ['document' => $document->nom_document, 'changements' => $changements];
    }

    public function summary(array $params): string
    {
        return "Modifier le document « {$params['document']} » : ".implode(' ; ', $params['changements']).'.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $document = Document::where('entreprise_id', $utilisateur->entreprise_id)->findOrFail($p['id']);

        $colonnes = [];
        if (isset($p['nom'])) {
            $colonnes['nom_document'] = $p['nom'];
        }
        if (isset($p['categorie'])) {
            $colonnes['categorie'] = $p['categorie'];
        }
        if (isset($p['departement'])) {
            [$visibilite, $departementId] = $this->resoudreDestinataires($utilisateur, $p['departement']);
            $colonnes += ['visibilite' => $visibilite, 'departement_id' => $departementId];
        }
        $document->update($colonnes);

        return [
            'message' => "Le document « {$document->nom_document} » a été modifié.",
            'donnees' => ['id' => $document->id, 'changements' => $p['changements']],
            'secret' => null,
        ];
    }
}

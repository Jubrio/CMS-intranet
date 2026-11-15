<?php

namespace App\Assistant\Tools;

use App\Models\Document;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ListerDocumentsTool implements ToolInterface
{
    use OutilsModules;

    private const LIMITE = 15;

    public function name(): string
    {
        return 'lister_documents';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Liste les documents de la bibliothèque (nom, catégorie, destinataires) avec leur identifiant. '
                    .'À appeler avant de modifier un document. Le contenu des fichiers n\'est pas accessible.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'recherche' => ['type' => 'string', 'description' => 'Texte cherché dans le nom'],
                        'categorie' => ['type' => 'string', 'description' => 'Filtrer par catégorie'],
                    ],
                ],
            ],
        ];
    }

    public function requiresConfirmation(): bool
    {
        return false;
    }

    public function authorize(Utilisateur $utilisateur): bool
    {
        return $this->droitsModules($utilisateur, ['documents'], ['documents.consulter']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'recherche' => ['nullable', 'string', 'max:100'],
            'categorie' => ['nullable', 'string', 'max:50'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }

        return $validateur->validated();
    }

    public function summary(array $params): string
    {
        return 'Lister les documents.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $f = $this->validate($utilisateur, $params);

        // Mêmes documents visibles que DocumentController::index()
        $requete = Document::where('entreprise_id', $utilisateur->entreprise_id)
            ->where(function ($q) use ($utilisateur) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $utilisateur->id);
                if ($utilisateur->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $utilisateur->departement_id));
                }
            });
        if (isset($f['recherche'])) {
            $requete->where('nom_document', 'ilike', '%'.addcslashes($f['recherche'], '%_\\').'%');
        }
        if (isset($f['categorie'])) {
            $requete->where('categorie', 'ilike', addcslashes($f['categorie'], '%_\\'));
        }

        $total = (clone $requete)->count();
        $lignes = $requete->orderByDesc('id')->limit(self::LIMITE)->get()->map(fn (Document $d) => [
            'id' => $d->id,
            'nom' => $d->nom_document,
            'categorie' => $d->categorie,
            'destinataires' => $d->visibilite === 'departement' ? 'un département' : 'toute l\'entreprise',
            'taille_ko' => $d->taille_fichier,
        ])->all();

        return [
            'message' => "{$total} document(s) trouvé(s)".($total > self::LIMITE ? ', les '.self::LIMITE.' plus récents sont affichés' : '').'.',
            'donnees' => ['total' => $total, 'documents' => $lignes],
            'secret' => null,
        ];
    }
}

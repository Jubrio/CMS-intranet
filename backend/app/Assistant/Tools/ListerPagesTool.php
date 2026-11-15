<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;
use App\Http\Controllers\Api\PageController;
use Illuminate\Support\Facades\Validator;

class ListerPagesTool implements ToolInterface
{
    use OutilsModules;

    private const LIMITE = 15;

    public function name(): string
    {
        return 'lister_pages';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Liste les pages internes (statut, emplacement dans le menu) avec leur identifiant. À appeler avant de modifier, publier ou archiver une page.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'statut' => ['type' => 'string', 'enum' => ['brouillon', 'publie', 'archive'], 'description' => 'Filtrer par statut'],
                        'recherche' => ['type' => 'string', 'description' => 'Texte cherché dans le titre'],
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
        return $this->droitsModules($utilisateur, ['pages'], ['pages.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'statut' => ['nullable', 'in:brouillon,publie,archive'],
            'recherche' => ['nullable', 'string', 'max:100'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }

        return $validateur->validated();
    }

    public function summary(array $params): string
    {
        return 'Lister les pages.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $f = $this->validate($utilisateur, $params);

        $requete = PageController::requeteVisibles($utilisateur, true);
        if (isset($f['statut'])) {
            $requete->where('statut_contenu', $f['statut']);
        }
        if (isset($f['recherche'])) {
            $requete->where('titre', 'ilike', '%'.addcslashes($f['recherche'], '%_\\').'%');
        }

        $total = (clone $requete)->count();
        $lignes = $requete->with('departement:id,nom_departement')->orderBy('emplacement_menu')->orderBy('titre')
            ->limit(self::LIMITE)->get()->map(fn ($c) => [
                'id' => $c->id,
                'titre' => $c->titre,
                'statut' => $c->statut_contenu,
                'destinataires' => $c->visibilite === 'departement' ? 'département '.$c->departement?->nom_departement : 'toute l\'entreprise',
                'emplacement_menu' => $c->emplacement_menu,
            ])->all();

        return [
            'message' => "{$total} page(s) trouvée(s)".($total > self::LIMITE ? ', les '.self::LIMITE.' premières sont affichées' : '').'.',
            'donnees' => ['total' => $total, 'pages' => $lignes],
            'secret' => null,
        ];
    }
}

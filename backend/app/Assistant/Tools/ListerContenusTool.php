<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ListerContenusTool implements ToolInterface
{
    use OutilsContenus;

    private const LIMITE = 15;

    public function name(): string
    {
        return 'lister_contenus';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Liste les contenus existants (actualités, annonces, articles, notes de service) avec leur identifiant. '
                    .'À appeler avant de modifier, publier ou archiver un contenu pour retrouver son identifiant.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => self::TYPES_CONTENU, 'description' => 'Type de contenu'],
                        'statut' => ['type' => 'string', 'enum' => ['brouillon', 'publie', 'archive'], 'description' => 'Statut (publie par défaut)'],
                        'recherche' => ['type' => 'string', 'description' => 'Texte cherché dans le titre ou le corps'],
                    ],
                    'required' => ['type'],
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
        return $this->peutSurAuMoinsUnType($utilisateur, 'consulter');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $params = array_filter($params, fn ($v) => $v !== null && $v !== '');
        $validateur = Validator::make($params, [
            'type' => ['required', 'in:'.implode(',', self::TYPES_CONTENU)],
            'statut' => ['nullable', 'in:brouillon,publie,archive'],
            'recherche' => ['nullable', 'string', 'max:100'],
        ], ['type.in' => 'Le type doit être actualite, annonce, article ou note_service.']);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        $d['statut'] ??= 'publie';

        if (! $this->acces()->autorise($utilisateur, $d['type'], 'consulter')) {
            throw new ToolException('Vous ne pouvez pas consulter ce type de contenu : module désactivé ou droit manquant.');
        }
        if ($d['statut'] !== 'publie' && ! $this->acces()->autorise($utilisateur, $d['type'], 'publier')) {
            throw new ToolException('Seules les personnes autorisées à publier voient les brouillons et les archives.');
        }

        return $d;
    }

    public function summary(array $params): string
    {
        return 'Lister les contenus.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $d = $this->validate($utilisateur, $params);

        // Mêmes contenus visibles que ContenuController::index()
        $requete = Contenu::where('entreprise_id', $utilisateur->entreprise_id)
            ->where('type_contenu', $d['type'])
            ->where('statut_contenu', $d['statut'])
            ->where(function ($q) use ($utilisateur) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $utilisateur->id);
                if ($utilisateur->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $utilisateur->departement_id));
                }
            });
        if ($d['statut'] === 'publie' && $d['type'] === 'annonce') {
            $requete->where(fn ($q) => $q->whereNull('date_expiration')->orWhere('date_expiration', '>=', today()->toDateString()));
        }
        if (isset($d['recherche'])) {
            $motif = '%'.addcslashes(trim($d['recherche']), '%_\\').'%';
            $requete->where(fn ($w) => $w->where('titre', 'ilike', $motif)->orWhere('corps', 'ilike', $motif));
        }

        $total = (clone $requete)->count();
        $lignes = $requete->with('departement:id,nom_departement', 'auteur:id,nom,prenom')
            ->orderByDesc('date_publication')->orderByDesc('id')
            ->limit(self::LIMITE)->get()
            ->map(fn (Contenu $c) => [
                'id' => $c->id,
                'titre' => $c->titre,
                'statut' => $c->statut_contenu,
                'visibilite' => $c->visibilite === 'departement' ? 'département '.$c->departement?->nom_departement : 'toute l\'entreprise',
                'date_publication' => $c->date_publication?->format('d/m/Y'),
                'date_expiration' => $c->date_expiration?->format('d/m/Y'),
                'auteur' => $c->auteur ? trim($c->auteur->prenom.' '.$c->auteur->nom) : null,
            ])->all();

        return [
            'message' => "{$total} contenu(s) trouvé(s)".($total > self::LIMITE ? ', les '.self::LIMITE.' plus récents sont affichés' : '').'.',
            'donnees' => ['total' => $total, 'contenus' => $lignes],
            'secret' => null,
        ];
    }
}

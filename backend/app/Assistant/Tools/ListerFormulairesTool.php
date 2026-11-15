<?php

namespace App\Assistant\Tools;

use App\Models\Formulaire;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ListerFormulairesTool implements ToolInterface
{
    use OutilsModules;

    private const LIMITE = 15;

    public function name(): string
    {
        return 'lister_formulaires';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Liste les formulaires internes (statut, date limite, nombre de réponses) avec leur identifiant. '
                    .'À appeler avant de publier ou clôturer un formulaire. Les réponses elles-mêmes ne sont pas accessibles.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'statut' => ['type' => 'string', 'enum' => ['brouillon', 'publie', 'cloture'], 'description' => 'Filtrer par statut'],
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
        return $this->droitsModules($utilisateur, ['formulaires'], ['formulaires.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'statut' => ['nullable', 'in:brouillon,publie,cloture'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }

        return $validateur->validated();
    }

    public function summary(array $params): string
    {
        return 'Lister les formulaires.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $f = $this->validate($utilisateur, $params);

        $requete = Formulaire::where('entreprise_id', $utilisateur->entreprise_id);
        if (isset($f['statut'])) {
            $requete->where('statut_formulaire', $f['statut']);
        }

        $total = (clone $requete)->count();
        $lignes = $requete->withCount('reponses')->orderByDesc('id')->limit(self::LIMITE)->get()->map(fn (Formulaire $x) => [
            'id' => $x->id,
            'titre' => $x->titre_formulaire,
            'statut' => $x->statut_formulaire,
            'date_limite' => $x->date_limite?->format('d/m/Y'),
            'nb_reponses' => $x->reponses_count,
        ])->all();

        return [
            'message' => "{$total} formulaire(s) trouvé(s)".($total > self::LIMITE ? ', les '.self::LIMITE.' plus récents sont affichés' : '').'.',
            'donnees' => ['total' => $total, 'formulaires' => $lignes],
            'secret' => null,
        ];
    }
}

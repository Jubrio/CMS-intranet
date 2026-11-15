<?php

namespace App\Assistant\Tools;

use App\Models\QuestionFaq;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ListerFaqTool implements ToolInterface
{
    use OutilsModules;

    private const LIMITE = 15;

    public function name(): string
    {
        return 'lister_faq';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Liste les questions de la FAQ de l\'entreprise avec leur identifiant. '
                    .'À appeler avant de modifier une question pour retrouver son identifiant.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'recherche' => ['type' => 'string', 'description' => 'Texte cherché dans la question ou la réponse'],
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
        return $this->droitsModules($utilisateur, ['faq'], ['faq.consulter']);
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
        return 'Lister les questions de la FAQ.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $f = $this->validate($utilisateur, $params);

        $requete = QuestionFaq::where('entreprise_id', $utilisateur->entreprise_id);
        if (isset($f['recherche'])) {
            $motif = '%'.addcslashes($f['recherche'], '%_\\').'%';
            $requete->where(fn ($w) => $w->where('question', 'ilike', $motif)->orWhere('reponse', 'ilike', $motif));
        }
        if (isset($f['categorie'])) {
            $requete->where('categorie', 'ilike', addcslashes($f['categorie'], '%_\\'));
        }

        $total = (clone $requete)->count();
        $lignes = $requete->orderBy('categorie')->orderBy('question')->limit(self::LIMITE)->get()->map(fn (QuestionFaq $q) => [
            'id' => $q->id,
            'categorie' => $q->categorie,
            'question' => $q->question,
            'reponse' => Str::limit($q->reponse, 200),
        ])->all();

        return [
            'message' => "{$total} question(s) trouvée(s)".($total > self::LIMITE ? ', les '.self::LIMITE.' premières sont affichées' : '').'.',
            'donnees' => ['total' => $total, 'questions' => $lignes],
            'secret' => null,
        ];
    }
}

<?php

namespace App\Assistant\Tools;

use App\Models\QuestionFaq;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class CreerQuestionFaqTool implements ToolInterface
{
    use OutilsModules;

    public function name(): string
    {
        return 'creer_question_faq';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Ajoute une question et sa réponse à la FAQ. La réponse vient uniquement de ce que l\'administrateur a fourni : ne jamais inventer de faits.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'question' => ['type' => 'string', 'description' => 'La question (250 caractères maximum)'],
                        'reponse' => ['type' => 'string', 'description' => 'La réponse complète'],
                        'categorie' => ['type' => 'string', 'description' => 'Catégorie (50 caractères maximum), par exemple RH, Informatique'],
                    ],
                    'required' => ['question', 'reponse', 'categorie'],
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
        return $this->droitsModules($utilisateur, ['faq'], ['faq.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($params, [
            'question' => ['required', 'string', 'max:250'],
            'reponse' => ['required', 'string', 'max:10000'],
            'categorie' => ['required', 'string', 'max:50'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        return array_map('trim', $d);
    }

    public function summary(array $params): string
    {
        return "Ajouter à la FAQ (catégorie {$params['categorie']}) la question « {$params['question']} ».\n\n{$params['reponse']}";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);

        $question = QuestionFaq::create($p + ['entreprise_id' => $utilisateur->entreprise_id, 'auteur_id' => $utilisateur->id]);

        return [
            'message' => 'La question a été ajoutée à la FAQ.',
            'donnees' => ['id' => $question->id, 'question' => $question->question],
            'secret' => null,
        ];
    }
}

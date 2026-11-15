<?php

namespace App\Assistant\Tools;

use App\Models\QuestionFaq;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ModifierQuestionFaqTool implements ToolInterface
{
    use RechercheParTitre;
    use OutilsModules;

    public function name(): string
    {
        return 'modifier_question_faq';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Modifie une question de la FAQ (question, réponse ou catégorie). Ne renseigner que les champs à changer. '
                    .'Désigner l\'élément par son titre actuel (titre_actuel), ou son identifiant s\'il est connu. La réponse vient uniquement de ce que l\'administrateur a fourni.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL de l\'élément visé (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant, seulement s\'il est connu (facultatif)'],
                        'question' => ['type' => 'string', 'description' => 'Nouvelle question'],
                        'reponse' => ['type' => 'string', 'description' => 'Nouvelle réponse complète'],
                        'categorie' => ['type' => 'string', 'description' => 'Nouvelle catégorie'],
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
        return $this->droitsModules($utilisateur, ['faq'], ['faq.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== '' && $v !== []), [
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:250'],
            'question' => ['nullable', 'string', 'max:250'],
            'reponse' => ['nullable', 'string', 'max:10000'],
            'categorie' => ['nullable', 'string', 'max:50'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $faq = $this->retrouverParTitre(QuestionFaq::where('entreprise_id', $utilisateur->entreprise_id), isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null, 'question', 'Aucune question', 'lister_faq');

        $canonique = ['id' => $faq->id];
        $changements = [];
        foreach (['question' => 'question', 'reponse' => 'réponse', 'categorie' => 'catégorie'] as $cle => $libelle) {
            if (isset($d[$cle]) && trim($d[$cle]) !== $faq->{$cle}) {
                $canonique[$cle] = trim($d[$cle]);
                $changements[] = $cle === 'reponse' ? 'réponse remplacée' : "{$libelle} → ".trim($d[$cle]);
            }
        }
        if ($changements === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles de la question.');
        }

        return $canonique + ['actuelle' => $faq->question, 'changements' => $changements];
    }

    public function summary(array $params): string
    {
        $phrase = "Modifier la question FAQ « {$params['actuelle']} » : ".implode(' ; ', $params['changements']).'.';

        return isset($params['reponse']) ? $phrase."\n\n".$params['reponse'] : $phrase;
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $faq = QuestionFaq::where('entreprise_id', $utilisateur->entreprise_id)->findOrFail($p['id']);
        $faq->update(array_intersect_key($p, array_flip(['question', 'reponse', 'categorie'])));

        return [
            'message' => 'La question de la FAQ a été modifiée.',
            'donnees' => ['id' => $faq->id, 'changements' => $p['changements']],
            'secret' => null,
        ];
    }
}

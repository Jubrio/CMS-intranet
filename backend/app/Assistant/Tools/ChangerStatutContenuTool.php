<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Validator;

class ChangerStatutContenuTool implements ToolInterface
{
    use OutilsContenus;

    public function __construct(private NotificationService $notifications) {}

    public function name(): string
    {
        return 'changer_statut_contenu';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Publie un brouillon (ou un contenu archivé), ou archive un contenu publié pour le retirer des fils. '
                    .'« Dépublier » signifie archiver. Ne supprime jamais. Désigner le contenu par son titre actuel (ou son identifiant s\'il est connu).',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => self::TYPES_CONTENU, 'description' => 'Type de contenu'],
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre actuel du contenu (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant du contenu, seulement s\'il est connu (facultatif)'],
                        'action' => ['type' => 'string', 'enum' => ['publier', 'archiver'], 'description' => 'publier ou archiver'],
                    ],
                    'required' => ['type', 'action'],
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
        return $this->peutSurAuMoinsUnType($utilisateur, 'publier');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'type' => ['required', 'in:'.implode(',', self::TYPES_CONTENU)],
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:150'],
            'action' => ['required', 'in:publier,archiver'],
        ], ['type.in' => 'Le type doit être actualite, annonce, article ou note_service.', 'action.in' => "L'action doit être publier ou archiver."]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        $contenu = $this->trouverContenuGerable($utilisateur, $d['type'], isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null);

        if ($d['action'] === 'publier') {
            if ($contenu->statut_contenu === 'publie') {
                throw new ToolException('Ce contenu est déjà publié.');
            }
            if ($contenu->date_expiration && $contenu->date_expiration->lt(today())) {
                throw new ToolException("La date d'expiration est dépassée : modifiez-la avant de publier.");
            }
        } elseif ($contenu->statut_contenu !== 'publie') {
            throw new ToolException('Seul un contenu publié peut être archivé.');
        }

        return ['type' => $d['type'], 'id' => $contenu->id, 'action' => $d['action'], 'contenu' => $contenu->titre];
    }

    public function summary(array $params): string
    {
        $libelle = self::LIBELLES_CONTENU[$params['type']];

        return $params['action'] === 'publier'
            ? "Publier l'{$libelle} « {$params['contenu']} » et prévenir les personnes concernées."
            : "Archiver l'{$libelle} « {$params['contenu']} » : elle ne sera plus visible dans l'intranet.";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $contenu = \App\Models\Contenu::where('entreprise_id', $utilisateur->entreprise_id)->findOrFail($p['id']);
        $libelle = self::LIBELLES_CONTENU[$p['type']];

        if ($p['action'] === 'publier') {
            $contenu->update(['statut_contenu' => 'publie', 'date_publication' => $contenu->date_publication ?? now()]);
            $this->notifications->publier(
                $utilisateur, 'publie', $p['type'], $contenu->id, $contenu->titre,
                $contenu->visibilite === 'departement' ? $contenu->departement_id : null,
            );
            $message = "L'{$libelle} « {$contenu->titre} » a été publiée.";
        } else {
            $contenu->update(['statut_contenu' => 'archive']);
            $this->notifications->retirer($p['type'], $contenu->id);
            $message = "L'{$libelle} « {$contenu->titre} » a été archivée.";
        }

        return [
            'message' => $message,
            'donnees' => ['id' => $contenu->id, 'statut' => $contenu->statut_contenu],
            'secret' => null,
        ];
    }
}

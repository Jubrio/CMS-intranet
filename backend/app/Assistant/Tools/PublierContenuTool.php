<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Validator;

class PublierContenuTool implements ToolInterface
{
    use ResoutParNom;

    private const TYPES = ['actualite', 'annonce', 'article'];

    private const LIBELLES = ['actualite' => 'actualité', 'annonce' => 'annonce', 'article' => 'article'];

    public function __construct(private AccesContenus $acces, private NotificationService $notifications) {}

    public function name(): string
    {
        return 'publier_contenu';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Publie une actualité, une annonce ou un article dans l'intranet, pour toute l'entreprise ou pour un département. "
                    ."Rédige le texte uniquement à partir de ce que l'administrateur a fourni : n'invente jamais de faits (dates, lieux, chiffres).",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => self::TYPES, 'description' => 'Type de contenu'],
                        'titre' => ['type' => 'string', 'description' => 'Titre court (150 caractères maximum)'],
                        'corps' => ['type' => 'string', 'description' => 'Texte complet du contenu'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire ; à omettre pour toute l'entreprise"],
                        'date_expiration' => ['type' => 'string', 'description' => "Date d'expiration AAAA-MM-JJ (annonce seulement, facultatif)"],
                        'brouillon' => ['type' => 'boolean', 'description' => 'true pour enregistrer sans publier'],
                    ],
                    'required' => ['type', 'titre', 'corps'],
                ],
            ],
        ];
    }

    public function requiresConfirmation(): bool
    {
        return true;
    }

    /** Le droit dépend du type et du module : au moins un type doit être publiable. */
    public function authorize(Utilisateur $utilisateur): bool
    {
        foreach (self::TYPES as $type) {
            if ($this->acces->autorise($utilisateur, $type, 'publier')) {
                return true;
            }
        }

        return false;
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $type = $params['type'] ?? null;

        $validateur = Validator::make($params, [
            'type' => ['required', 'in:'.implode(',', self::TYPES)],
            'titre' => ['required', 'string', 'max:150'],
            'corps' => ['required', 'string', 'max:20000'],
            'departement' => ['nullable', 'string', 'max:150'],
            'date_expiration' => $type === 'annonce' ? ['nullable', 'date', 'after_or_equal:today'] : ['prohibited'],
            'brouillon' => ['nullable', 'boolean'],
        ], [
            'type.in' => 'Le type doit être actualite, annonce ou article.',
            'date_expiration.prohibited' => "La date d'expiration n'existe que pour les annonces.",
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        if (! $this->acces->autorise($utilisateur, $d['type'], 'publier')) {
            throw new ToolException(
                'Vous ne pouvez pas publier de '.self::LIBELLES[$d['type']].' : module désactivé ou droit manquant.'
            );
        }

        $departement = null;
        if (! empty($d['departement'])) {
            $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();
            $departement = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
            if (! $departement) {
                throw new ToolException(
                    "Département « {$d['departement']} » introuvable. Départements disponibles : "
                    .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.'
                );
            }
        }

        $visibilite = $departement ? 'departement' : 'entreprise';
        if (! $this->acces->peutCibler($utilisateur, $visibilite, $departement?->id)) {
            throw new ToolException('Un Manager ne publie que pour son département.');
        }

        return [
            'type' => $d['type'],
            'titre' => trim($d['titre']),
            'corps' => trim($d['corps']),
            'departement' => $departement?->nom_departement,
            'departement_id' => $departement?->id,
            'visibilite' => $visibilite,
            'date_expiration' => $d['date_expiration'] ?? null,
            'brouillon' => (bool) ($d['brouillon'] ?? false),
        ];
    }

    public function summary(array $params): string
    {
        $libelle = self::LIBELLES[$params['type']];
        $verbe = $params['brouillon'] ? 'Enregistrer en brouillon' : 'Publier';
        $cible = $params['departement'] ? "pour le département {$params['departement']}" : "pour toute l'entreprise";
        $expiration = $params['date_expiration'] ? " (expire le {$params['date_expiration']})" : '';

        return "{$verbe} l'{$libelle} « {$params['titre']} » {$cible}{$expiration}.\n\n{$params['corps']}";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        // Revérification au moment d'exécuter : module, droits ou département ont pu changer.
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);

        $contenu = Contenu::create([
            'entreprise_id' => $utilisateur->entreprise_id,
            'auteur_id' => $utilisateur->id,
            'type_contenu' => $p['type'],
            'titre' => $p['titre'],
            'corps' => $p['corps'],
            'statut_contenu' => $p['brouillon'] ? 'brouillon' : 'publie',
            'visibilite' => $p['visibilite'],
            'departement_id' => $p['departement_id'],
            'date_expiration' => $p['date_expiration'],
            'date_publication' => $p['brouillon'] ? null : now(),
        ]);

        if (! $p['brouillon']) {
            $this->notifications->publier(
                $utilisateur, 'publie', $p['type'], $contenu->id, $contenu->titre, $p['departement_id'],
            );
        }

        $libelle = self::LIBELLES[$p['type']];

        return [
            'message' => $p['brouillon']
                ? "L'{$libelle} « {$contenu->titre} » a été enregistrée en brouillon."
                : "L'{$libelle} « {$contenu->titre} » a été publiée.",
            'donnees' => [
                'id' => $contenu->id,
                'type' => $p['type'],
                'statut' => $contenu->statut_contenu,
                'visibilite' => $p['visibilite'],
                'departement' => $p['departement'],
            ],
            'secret' => null,
        ];
    }
}

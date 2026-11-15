<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Evenement;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Validator;

class CreerEvenementTool implements ToolInterface
{
    use OutilsModules;
    use ResoutParNom;

    public function __construct(private AccesContenus $acces, private NotificationService $notifications) {}

    public function name(): string
    {
        return 'creer_evenement';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Crée un événement dans le calendrier de l'entreprise ou d'un département et prévient les personnes concernées. "
                    ."Les dates doivent être données par l'administrateur : ne jamais les inventer ni les deviner.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre' => ['type' => 'string', 'description' => "Titre de l'événement"],
                        'date_debut' => ['type' => 'string', 'description' => 'Début : AAAA-MM-JJ ou AAAA-MM-JJ HH:MM'],
                        'date_fin' => ['type' => 'string', 'description' => 'Fin : AAAA-MM-JJ ou AAAA-MM-JJ HH:MM (même jour que le début si événement d\'une journée)'],
                        'description' => ['type' => 'string', 'description' => 'Description (facultatif)'],
                        'lieu' => ['type' => 'string', 'description' => 'Lieu (facultatif)'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire ; à omettre pour toute l'entreprise"],
                    ],
                    'required' => ['titre', 'date_debut', 'date_fin'],
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
        return $this->droitsModules($utilisateur, ['calendrier', 'evenements'], ['evenements.gerer']);
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $params = array_filter($params, fn ($v) => $v !== null && $v !== '');
        $validateur = Validator::make($params, [
            'titre' => ['required', 'string', 'max:150'],
            'date_debut' => ['required', 'string'],
            'date_fin' => ['required', 'string'],
            'description' => ['nullable', 'string', 'max:5000'],
            'lieu' => ['nullable', 'string', 'max:100'],
            'departement' => ['nullable', 'string', 'max:150'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $debut = $this->lireDate($d['date_debut'], false);
        $fin = $this->lireDate($d['date_fin'], true);
        if ($fin->lt($debut)) {
            throw new ToolException('La date de fin doit être postérieure ou égale à la date de début.');
        }

        $departement = null;
        if (isset($d['departement'])) {
            $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();
            $departement = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
            if (! $departement) {
                throw new ToolException("Département « {$d['departement']} » introuvable. Départements disponibles : "
                    .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
            }
        }
        $visibilite = $departement ? 'departement' : 'entreprise';
        if (! $this->acces->peutCibler($utilisateur, $visibilite, $departement?->id)) {
            throw new ToolException('Un Manager ne gère que les événements de son département.');
        }

        return [
            'titre' => trim($d['titre']),
            'date_debut' => $debut->format('Y-m-d H:i'),
            'date_fin' => $fin->format('Y-m-d H:i'),
            'description' => $d['description'] ?? null,
            'lieu' => $d['lieu'] ?? null,
            'departement' => $departement?->nom_departement,
        ];
    }

    public function summary(array $params): string
    {
        $debut = $this->lireDate($params['date_debut'], false)->format('d/m/Y H:i');
        $fin = $this->lireDate($params['date_fin'], true)->format('d/m/Y H:i');
        $cible = $params['departement'] ? "pour le département {$params['departement']}" : "pour toute l'entreprise";

        return "Créer l'événement « {$params['titre']} » du {$debut} au {$fin}"
            .($params['lieu'] ? ", lieu : {$params['lieu']}" : '')." {$cible}. Les personnes concernées seront prévenues.";
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);
        $departementId = $p['departement']
            ? Departement::where('entreprise_id', $utilisateur->entreprise_id)->where('nom_departement', $p['departement'])->value('id') : null;

        $evenement = Evenement::create([
            'entreprise_id' => $utilisateur->entreprise_id,
            'auteur_id' => $utilisateur->id,
            'departement_id' => $departementId,
            'titre_evenement' => $p['titre'],
            'description_evenement' => $p['description'],
            'date_debut' => $p['date_debut'],
            'date_fin' => $p['date_fin'],
            'lieu' => $p['lieu'],
            'visibilite' => $departementId ? 'departement' : 'entreprise',
        ]);
        $this->notifications->publier($utilisateur, 'cree', 'evenement', $evenement->id, $evenement->titre_evenement, $departementId);

        return [
            'message' => "L'événement « {$evenement->titre_evenement} » a été créé.",
            'donnees' => ['id' => $evenement->id, 'titre' => $evenement->titre_evenement],
            'secret' => null,
        ];
    }
}

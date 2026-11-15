<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Evenement;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ModifierEvenementTool implements ToolInterface
{
    use RechercheParTitre;
    use OutilsModules;
    use ResoutParNom;

    public function __construct(private AccesContenus $acces) {}

    public function name(): string
    {
        return 'modifier_evenement';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => 'Modifie un événement existant (titre, dates, lieu, description, destinataires). Ne renseigner que les champs à changer. '
                    .'Désigner l\'élément par son titre actuel (titre_actuel), ou son identifiant s\'il est connu. Les dates viennent de l\'administrateur : ne jamais les inventer.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'titre_actuel' => ['type' => 'string', 'description' => 'Titre ACTUEL de l\'élément visé (exact ou partiel)'],
                        'id' => ['type' => 'integer', 'description' => 'Identifiant, seulement s\'il est connu (facultatif)'],
                        'titre' => ['type' => 'string', 'description' => 'Nouveau titre'],
                        'date_debut' => ['type' => 'string', 'description' => 'Nouveau début AAAA-MM-JJ ou AAAA-MM-JJ HH:MM'],
                        'date_fin' => ['type' => 'string', 'description' => 'Nouvelle fin AAAA-MM-JJ ou AAAA-MM-JJ HH:MM'],
                        'description' => ['type' => 'string', 'description' => 'Nouvelle description'],
                        'lieu' => ['type' => 'string', 'description' => 'Nouveau lieu'],
                        'departement' => ['type' => 'string', 'description' => "Nom du département destinataire, ou « aucun » pour toute l'entreprise"],
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
        return $this->droitsModules($utilisateur, ['calendrier', 'evenements'], ['evenements.gerer']);
    }

    /** @return array{0: Evenement, 1: array, 2: array} */
    private function analyser(Utilisateur $utilisateur, array $params): array
    {
        $params = array_filter($params, fn ($v) => $v !== null && $v !== '' && $v !== []);
        $validateur = Validator::make(array_filter($params, fn ($v) => $v !== null && $v !== ''), [
            'id' => ['nullable', 'integer', 'min:1'],
            'titre_actuel' => ['nullable', 'string', 'max:250'],
            'titre' => ['nullable', 'string', 'max:150'],
            'date_debut' => ['nullable', 'string'],
            'date_fin' => ['nullable', 'string'],
            'description' => ['nullable', 'string', 'max:5000'],
            'lieu' => ['nullable', 'string', 'max:100'],
            'departement' => ['nullable', 'string', 'max:150'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();

        $evenement = $this->retrouverParTitre(Evenement::where('entreprise_id', $utilisateur->entreprise_id), isset($d['id']) ? (int) $d['id'] : null, $d['titre_actuel'] ?? null, 'titre_evenement', 'Aucun événement', 'lister_evenements');
        if (! $this->acces->peutCibler($utilisateur, $evenement->visibilite, $evenement->departement_id)) {
            throw new ToolException('Un Manager ne gère que les événements de son département.');
        }

        $colonnes = [];
        $changements = [];
        $canonique = ['id' => $evenement->id];

        foreach (['titre' => ['titre_evenement', 'titre'], 'description' => ['description_evenement', 'description'], 'lieu' => ['lieu', 'lieu']] as $cle => [$colonne, $libelle]) {
            if (isset($d[$cle]) && trim($d[$cle]) !== (string) $evenement->{$colonne}) {
                $colonnes[$colonne] = trim($d[$cle]);
                $canonique[$cle] = trim($d[$cle]);
                $changements[] = "{$libelle} → ".trim($d[$cle]);
            }
        }

        $debut = $evenement->date_debut;
        $fin = $evenement->date_fin;
        if (isset($d['date_debut'])) {
            $nouveau = $this->lireDate($d['date_debut'], false);
            if (! $nouveau->equalTo($debut)) {
                $changements[] = 'début → '.$nouveau->format('d/m/Y H:i');
                $colonnes['date_debut'] = $nouveau->format('Y-m-d H:i');
            }
            $debut = $nouveau;
            $canonique['date_debut'] = $nouveau->format('Y-m-d H:i');
        }
        if (isset($d['date_fin'])) {
            $nouveau = $this->lireDate($d['date_fin'], true);
            if (! $nouveau->equalTo($fin)) {
                $changements[] = 'fin → '.$nouveau->format('d/m/Y H:i');
                $colonnes['date_fin'] = $nouveau->format('Y-m-d H:i');
            }
            $fin = $nouveau;
            $canonique['date_fin'] = $nouveau->format('Y-m-d H:i');
        }
        if ($fin->lt($debut)) {
            throw new ToolException('La date de fin doit être postérieure ou égale à la date de début.');
        }

        if (isset($d['departement'])) {
            $nom = Str::lower(Str::ascii(trim($d['departement'])));
            if (in_array($nom, ['aucun', 'aucune', 'entreprise', 'tous', 'toute l\'entreprise'], true)) {
                if ($evenement->visibilite !== 'entreprise') {
                    $changements[] = "destinataires → toute l'entreprise";
                }
                $colonnes['visibilite'] = 'entreprise';
                $colonnes['departement_id'] = null;
                $canonique['departement'] = 'aucun';
            } else {
                $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();
                $departement = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
                if (! $departement) {
                    throw new ToolException("Département « {$d['departement']} » introuvable. Départements disponibles : "
                        .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
                }
                if ($evenement->visibilite !== 'departement' || $evenement->departement_id !== $departement->id) {
                    $changements[] = "destinataires → département {$departement->nom_departement}";
                }
                $colonnes['visibilite'] = 'departement';
                $colonnes['departement_id'] = $departement->id;
                $canonique['departement'] = $departement->nom_departement;
            }
            if (! $this->acces->peutCibler($utilisateur, $colonnes['visibilite'], $colonnes['departement_id'])) {
                throw new ToolException('Un Manager ne gère que les événements de son département.');
            }
        }

        if ($changements === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles de l\'événement.');
        }

        return [$evenement, $colonnes, $canonique + ['evenement' => $evenement->titre_evenement, 'changements' => $changements]];
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        return $this->analyser($utilisateur, $params)[2];
    }

    public function summary(array $params): string
    {
        return "Modifier l'événement « {$params['evenement']} » : ".implode(' ; ', $params['changements']).'.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        [$evenement, $colonnes, $canonique] = $this->analyser($utilisateur, $params);
        $evenement->update($colonnes);

        return [
            'message' => "L'événement « {$evenement->titre_evenement} » a été modifié.",
            'donnees' => ['id' => $evenement->id, 'changements' => $canonique['changements']],
            'secret' => null,
        ];
    }
}

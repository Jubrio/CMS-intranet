<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CreerUtilisateurTool implements ToolInterface
{
    use ResoutParNom;

    public function __construct(private DroitsUtilisateurs $droits) {}

    public function name(): string
    {
        return 'creer_utilisateur';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Crée un compte utilisateur dans l'intranet de l'entreprise. "
                    .'Le mot de passe est généré automatiquement : ne jamais le demander ni l\'inventer.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'nom' => ['type' => 'string', 'description' => 'Nom de famille'],
                        'prenom' => ['type' => 'string', 'description' => 'Prénom'],
                        'email' => ['type' => 'string', 'description' => 'Adresse e-mail professionnelle'],
                        'role' => ['type' => 'string', 'description' => 'Nom du rôle : Employé, Manager, RH, Administrateur ou un rôle personnalisé'],
                        'departement' => ['type' => 'string', 'description' => 'Nom du département (facultatif)'],
                        'poste' => ['type' => 'string', 'description' => 'Intitulé du poste (facultatif)'],
                        'telephone' => ['type' => 'string', 'description' => 'Téléphone (facultatif)'],
                    ],
                    'required' => ['nom', 'prenom', 'email', 'role'],
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
        return $utilisateur->role->permissions()->where('code_permission', 'utilisateurs.gerer')->exists();
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($params, [
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', Rule::unique('utilisateurs', 'email')],
            'role' => ['required', 'string', 'max:100'],
            'departement' => ['nullable', 'string', 'max:150'],
            'poste' => ['nullable', 'string', 'max:100'],
            'telephone' => ['nullable', 'string', 'max:30'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $donnees = $validateur->validated();

        $entrepriseId = $utilisateur->entreprise_id;

        $roles = Role::where('entreprise_id', $entrepriseId)->get();
        $role = $this->trouverParNom($roles, 'nom_role', $donnees['role']);
        if (! $role) {
            throw new ToolException(
                "Rôle « {$donnees['role']} » introuvable. Rôles disponibles : ".$roles->pluck('nom_role')->implode(', ').'.'
            );
        }
        if (! $this->droits->roleAttribuable($utilisateur, $role)) {
            throw new ToolException('Vous ne pouvez pas attribuer un rôle plus élevé que le vôtre.');
        }

        $departement = null;
        if (! empty($donnees['departement'])) {
            $departements = Departement::where('entreprise_id', $entrepriseId)->get();
            $departement = $this->trouverParNom($departements, 'nom_departement', $donnees['departement']);
            if (! $departement) {
                throw new ToolException(
                    "Département « {$donnees['departement']} » introuvable. Départements disponibles : "
                    .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.'
                );
            }
        }

        return [
            'nom' => trim($donnees['nom']),
            'prenom' => trim($donnees['prenom']),
            'email' => trim($donnees['email']),
            'role' => $role->nom_role,
            'role_id' => $role->id,
            'departement' => $departement?->nom_departement,
            'departement_id' => $departement?->id,
            'poste' => $donnees['poste'] ?? null,
            'telephone' => $donnees['telephone'] ?? null,
        ];
    }

    public function summary(array $params): string
    {
        $phrase = "Créer le compte de {$params['prenom']} {$params['nom']} ({$params['email']}) avec le rôle {$params['role']}";
        if (! empty($params['departement'])) {
            $phrase .= ", département {$params['departement']}";
        }

        return $phrase.'.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        // Entre la proposition et la confirmation, l'état a pu changer (e-mail pris, droits modifiés) :
        // on revérifie tout au moment d'exécuter.
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $p = $this->validate($utilisateur, $params);

        $motDePasse = Str::password(16);

        $cree = Utilisateur::create([
            'entreprise_id' => $utilisateur->entreprise_id,
            'role_id' => $p['role_id'],
            'departement_id' => $p['departement_id'],
            'nom' => $p['nom'],
            'prenom' => $p['prenom'],
            'email' => $p['email'],
            'mot_de_passe' => $motDePasse,
            'poste' => $p['poste'],
            'telephone' => $p['telephone'],
            'statut_compte' => 'actif',
        ]);

        return [
            'message' => "Le compte de {$cree->prenom} {$cree->nom} a été créé.",
            'donnees' => [
                'id' => $cree->id,
                'email' => $cree->email,
                'role' => $p['role'],
                'departement' => $p['departement'],
            ],
            'secret' => ['mot_de_passe_temporaire' => $motDePasse],
        ];
    }
}

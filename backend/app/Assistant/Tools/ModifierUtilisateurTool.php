<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use App\Services\HierarchieUtilisateurs;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ModifierUtilisateurTool implements ToolInterface
{
    use OutilsOrganisation;
    use ResoutParNom;

    public function __construct(private DroitsUtilisateurs $droits, private HierarchieUtilisateurs $hierarchie) {}

    public function name(): string
    {
        return 'modifier_utilisateur';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Modifie un compte existant : nom, prénom, e-mail, poste, téléphone, rôle, département ou supérieur. "
                    .'Ne renseigner que les champs à changer. Le mot de passe ne se modifie pas ici. '
                    .'Pour retirer le département ou le supérieur, mettre « aucun ».',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'email' => ['type' => 'string', 'description' => 'E-mail ACTUEL du compte à modifier, ou son nom complet (prénom nom) si l\'e-mail n\'est pas connu. Ne jamais inventer d\'adresse.'],
                        'nouveau_nom' => ['type' => 'string', 'description' => 'Nouveau nom de famille'],
                        'nouveau_prenom' => ['type' => 'string', 'description' => 'Nouveau prénom'],
                        'nouvel_email' => ['type' => 'string', 'description' => 'Nouvelle adresse e-mail'],
                        'poste' => ['type' => 'string', 'description' => 'Nouvel intitulé de poste'],
                        'telephone' => ['type' => 'string', 'description' => 'Nouveau téléphone'],
                        'role' => ['type' => 'string', 'description' => 'Nom du nouveau rôle'],
                        'departement' => ['type' => 'string', 'description' => 'Nom du nouveau département, ou « aucun »'],
                        'superieur' => ['type' => 'string', 'description' => 'E-mail du nouveau supérieur hiérarchique, ou « aucun »'],
                    ],
                    'required' => ['email'],
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
        return $this->aPermission($utilisateur, 'utilisateurs.gerer');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($this->renseignes($params), [
            'email' => ['required', 'string', 'max:255'],
            'nouveau_nom' => ['nullable', 'string', 'max:100'],
            'nouveau_prenom' => ['nullable', 'string', 'max:100'],
            'nouvel_email' => ['nullable', 'email', 'max:255'],
            'poste' => ['nullable', 'string', 'max:100'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'role' => ['nullable', 'string', 'max:100'],
            'departement' => ['nullable', 'string', 'max:150'],
            'superieur' => ['nullable', 'string', 'max:255'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        $entrepriseId = $utilisateur->entreprise_id;

        $cible = $this->trouverUtilisateur($utilisateur, $d['email']);
        if (! $this->droits->peutGerer($utilisateur, $cible)) {
            throw new ToolException('Ce compte possède des droits supérieurs aux vôtres.');
        }

        $colonnes = [];
        $changements = [];
        $canonique = ['email' => $cible->email];

        foreach (['nouveau_nom' => ['nom', 'nom'], 'nouveau_prenom' => ['prenom', 'prénom'], 'poste' => ['poste', 'poste'], 'telephone' => ['telephone', 'téléphone']] as $param => [$colonne, $libelle]) {
            if (isset($d[$param]) && trim($d[$param]) !== (string) $cible->{$colonne}) {
                $colonnes[$colonne] = trim($d[$param]);
                $canonique[$param] = trim($d[$param]);
                $changements[] = "{$libelle} → {$colonnes[$colonne]}";
            }
        }

        if (isset($d['nouvel_email']) && Str::lower(trim($d['nouvel_email'])) !== Str::lower($cible->email)) {
            $nouveau = trim($d['nouvel_email']);
            if (Utilisateur::where('email', $nouveau)->where('id', '!=', $cible->id)->exists()) {
                throw new ToolException("L'adresse « {$nouveau} » est déjà utilisée.");
            }
            if (! $this->droits->peutModifierIdentifiants($utilisateur, $cible)) {
                throw new ToolException("Vous ne pouvez pas modifier l'e-mail d'un compte de niveau égal ou supérieur au vôtre.");
            }
            $colonnes['email'] = $nouveau;
            $canonique['nouvel_email'] = $nouveau;
            $changements[] = "e-mail → {$nouveau}";
        }

        if (isset($d['role'])) {
            $roles = Role::where('entreprise_id', $entrepriseId)->get();
            $role = $this->trouverParNom($roles, 'nom_role', $d['role']);
            if (! $role) {
                throw new ToolException("Rôle « {$d['role']} » introuvable. Rôles disponibles : ".$roles->pluck('nom_role')->implode(', ').'.');
            }
            if ($role->id !== $cible->role_id) {
                if (! $this->droits->roleAttribuable($utilisateur, $role)) {
                    throw new ToolException('Vous ne pouvez pas attribuer un rôle plus élevé que le vôtre.');
                }
                if ($this->droits->estDernierAdminActif($cible)) {
                    throw new ToolException('Le dernier administrateur actif ne peut pas changer de rôle.');
                }
                $colonnes['role_id'] = $role->id;
                $changements[] = "rôle → {$role->nom_role}";
            }
            $canonique['role'] = $role->nom_role;
        }

        if (isset($d['departement'])) {
            if ($this->estAucun($d['departement'])) {
                if ($cible->departement_id !== null) {
                    $colonnes['departement_id'] = null;
                    $changements[] = 'département → aucun';
                }
                $canonique['departement'] = 'aucun';
            } else {
                $departements = Departement::where('entreprise_id', $entrepriseId)->get();
                $departement = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
                if (! $departement) {
                    throw new ToolException("Département « {$d['departement']} » introuvable. Départements disponibles : "
                        .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
                }
                if ($departement->id !== $cible->departement_id) {
                    $colonnes['departement_id'] = $departement->id;
                    $changements[] = "département → {$departement->nom_departement}";
                }
                $canonique['departement'] = $departement->nom_departement;
            }
        }

        if (isset($d['superieur'])) {
            if ($this->estAucun($d['superieur'])) {
                if ($cible->superieur_id !== null) {
                    $colonnes['superieur_id'] = null;
                    $changements[] = 'supérieur → aucun';
                }
                $canonique['superieur'] = 'aucun';
            } else {
                $superieur = $this->trouverUtilisateur($utilisateur, $d['superieur']);
                if ($superieur->id === $cible->id || $this->hierarchie->creeUnCycle($cible->id, $superieur->id)) {
                    throw new ToolException('Ce choix créerait une boucle hiérarchique.');
                }
                if ($superieur->id !== $cible->superieur_id) {
                    $colonnes['superieur_id'] = $superieur->id;
                    $changements[] = 'supérieur → '.$this->nomComplet($superieur);
                }
                $canonique['superieur'] = $superieur->email;
            }
        }

        if ($colonnes === []) {
            throw new ToolException('Aucun changement à appliquer : les valeurs demandées sont déjà celles du compte.');
        }

        return $canonique + [
            'cible' => $this->nomComplet($cible),
            'changements' => $changements,
        ];
    }

    public function summary(array $params): string
    {
        return "Modifier le compte de {$params['cible']} ({$params['email']}) : ".implode(' ; ', $params['changements']).'.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        // Tout est revérifié : l'état a pu changer depuis la proposition.
        $p = $this->validate($utilisateur, $params);
        $cible = $this->trouverUtilisateur($utilisateur, $p['email']);

        $colonnes = [];
        $map = ['nouveau_nom' => 'nom', 'nouveau_prenom' => 'prenom', 'poste' => 'poste', 'telephone' => 'telephone', 'nouvel_email' => 'email'];
        foreach ($map as $param => $colonne) {
            if (isset($p[$param])) {
                $colonnes[$colonne] = $p[$param];
            }
        }
        if (isset($p['role'])) {
            $colonnes['role_id'] = Role::where('entreprise_id', $cible->entreprise_id)->where('nom_role', $p['role'])->value('id');
        }
        if (isset($p['departement'])) {
            $colonnes['departement_id'] = $this->estAucun($p['departement']) ? null
                : Departement::where('entreprise_id', $cible->entreprise_id)->where('nom_departement', $p['departement'])->value('id');
        }
        if (isset($p['superieur'])) {
            $colonnes['superieur_id'] = $this->estAucun($p['superieur']) ? null : $this->trouverUtilisateur($utilisateur, $p['superieur'])->id;
        }

        $emailChange = isset($colonnes['email']) && $colonnes['email'] !== $cible->email;
        $cible->update($colonnes);
        if ($emailChange && $cible->id !== $utilisateur->id) {
            $cible->tokens()->delete();
        }

        return [
            'message' => 'Le compte de '.$this->nomComplet($cible).' a été modifié.',
            'donnees' => ['id' => $cible->id, 'email' => $cible->email, 'changements' => $p['changements']],
            'secret' => null,
        ];
    }
}

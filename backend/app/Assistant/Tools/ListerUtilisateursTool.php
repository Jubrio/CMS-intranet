<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Role;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Validator;

class ListerUtilisateursTool implements ToolInterface
{
    use OutilsOrganisation;
    use ResoutParNom;

    private const LIMITE = 25;

    public function name(): string
    {
        return 'lister_utilisateurs';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Liste les utilisateurs de l'entreprise (nom, e-mail, rôle, département, statut), avec filtres facultatifs. "
                    .'Sert à retrouver une adresse e-mail avant de modifier un compte, ou à répondre à « qui est dans tel département ? ».',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'recherche' => ['type' => 'string', 'description' => 'Texte cherché dans le nom, le prénom ou l\'e-mail'],
                        'role' => ['type' => 'string', 'description' => 'Filtrer par nom de rôle'],
                        'departement' => ['type' => 'string', 'description' => 'Filtrer par nom de département'],
                        'statut' => ['type' => 'string', 'enum' => ['actif', 'inactif'], 'description' => 'Filtrer par statut du compte'],
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
        return $this->aPermission($utilisateur, 'utilisateurs.gerer');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        $validateur = Validator::make($this->renseignes($params), [
            'recherche' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'max:100'],
            'departement' => ['nullable', 'string', 'max:150'],
            'statut' => ['nullable', 'in:actif,inactif'],
        ]);
        if ($validateur->fails()) {
            throw new ToolException('Données invalides : '.implode(' ', $validateur->errors()->all()));
        }
        $d = $validateur->validated();
        $filtres = [];

        if (isset($d['role'])) {
            $roles = Role::where('entreprise_id', $utilisateur->entreprise_id)->get();
            $role = $this->trouverParNom($roles, 'nom_role', $d['role']);
            if (! $role) {
                throw new ToolException("Rôle « {$d['role']} » introuvable. Rôles disponibles : ".$roles->pluck('nom_role')->implode(', ').'.');
            }
            $filtres['role'] = $role->nom_role;
        }
        if (isset($d['departement'])) {
            $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();
            $departement = $this->trouverParNom($departements, 'nom_departement', $d['departement']);
            if (! $departement) {
                throw new ToolException("Département « {$d['departement']} » introuvable. Départements disponibles : "
                    .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
            }
            $filtres['departement'] = $departement->nom_departement;
        }
        foreach (['recherche', 'statut'] as $cle) {
            if (isset($d[$cle])) {
                $filtres[$cle] = $d[$cle];
            }
        }

        return $filtres;
    }

    public function summary(array $params): string
    {
        return 'Lister les utilisateurs.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $f = $this->validate($utilisateur, $params);
        $entrepriseId = $utilisateur->entreprise_id;

        $requete = Utilisateur::with('role:id,nom_role', 'departement:id,nom_departement')
            ->where('entreprise_id', $entrepriseId)
            ->orderBy('nom')->orderBy('prenom');

        if (isset($f['statut'])) {
            $requete->where('statut_compte', $f['statut']);
        }
        if (isset($f['role'])) {
            $requete->whereHas('role', fn ($q) => $q->where('nom_role', $f['role']));
        }
        if (isset($f['departement'])) {
            $requete->whereHas('departement', fn ($q) => $q->where('nom_departement', $f['departement']));
        }
        if (isset($f['recherche'])) {
            $motif = '%'.addcslashes($f['recherche'], '%_\\').'%';
            $requete->where(fn ($w) => $w->where('nom', 'ilike', $motif)
                ->orWhere('prenom', 'ilike', $motif)->orWhere('email', 'ilike', $motif));
        }

        $total = (clone $requete)->count();
        $lignes = $requete->limit(self::LIMITE)->get()->map(fn (Utilisateur $u) => [
            'nom' => $this->nomComplet($u),
            'email' => $u->email,
            'role' => $u->role?->nom_role,
            'departement' => $u->departement?->nom_departement,
            'poste' => $u->poste,
            'statut' => $u->statut_compte,
        ])->all();

        return [
            'message' => "{$total} utilisateur(s) trouvé(s)".($total > self::LIMITE ? ', les '.self::LIMITE.' premiers sont affichés' : '').'.',
            'donnees' => ['total' => $total, 'affiches' => count($lignes), 'utilisateurs' => $lignes],
            'secret' => null,
        ];
    }
}

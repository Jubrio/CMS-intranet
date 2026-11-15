<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Utilisateur;

class ListerDepartementsTool implements ToolInterface
{
    use OutilsOrganisation;

    public function name(): string
    {
        return 'lister_departements';
    }

    public function schema(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => "Liste les départements de l'entreprise avec leur responsable, leur département parent et leur nombre d'employés.",
                'parameters' => ['type' => 'object', 'properties' => (object) []],
            ],
        ];
    }

    public function requiresConfirmation(): bool
    {
        return false;
    }

    public function authorize(Utilisateur $utilisateur): bool
    {
        return $this->aPermission($utilisateur, 'utilisateurs.departements');
    }

    public function validate(Utilisateur $utilisateur, array $params): array
    {
        return [];
    }

    public function summary(array $params): string
    {
        return 'Lister les départements.';
    }

    public function execute(Utilisateur $utilisateur, array $params): array
    {
        if (! $this->authorize($utilisateur)) {
            throw new ToolException('Action non autorisée pour votre rôle.');
        }
        $liste = Departement::with('responsable:id,nom,prenom', 'parent:id,nom_departement')
            ->withCount('utilisateurs')
            ->where('entreprise_id', $utilisateur->entreprise_id)
            ->orderBy('nom_departement')->get()
            ->map(fn (Departement $d) => [
                'nom' => $d->nom_departement,
                'parent' => $d->parent?->nom_departement,
                'responsable' => $d->responsable ? $this->nomComplet($d->responsable) : null,
                'nb_employes' => $d->utilisateurs_count,
            ])->all();

        return [
            'message' => count($liste).' département(s).',
            'donnees' => ['departements' => $liste],
            'secret' => null,
        ];
    }
}

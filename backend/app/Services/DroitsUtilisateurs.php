<?php

namespace App\Services;

use App\Models\Role;
use App\Models\Utilisateur;

class DroitsUtilisateurs
{
    // RG32 : un rôle est attribuable si toutes ses permissions sont déjà celles de l'appelant
    public function roleAttribuable(Utilisateur $appelant, Role $cible): bool
    {
        $requises = $cible->permissions()->pluck('code_permission');
        $detenues = $appelant->role->permissions()->pluck('code_permission');

        return $requises->diff($detenues)->isEmpty();
    }

    // Même logique appliquée au compte visé : on ne gère pas un compte plus puissant que soi
    public function peutGerer(Utilisateur $appelant, Utilisateur $cible): bool
    {
        return $this->roleAttribuable($appelant, $cible->role);
    }

    // RG33 : vrai si la cible est le seul Administrateur actif de son entreprise
    public function estDernierAdminActif(Utilisateur $cible): bool
    {
        if ($cible->role?->nom_role !== 'Administrateur' || $cible->statut_compte !== 'actif') {
            return false;
        }

        $autres = Utilisateur::where('entreprise_id', $cible->entreprise_id)
            ->where('statut_compte', 'actif')
            ->where('id', '!=', $cible->id)
            ->whereHas('role', fn ($q) => $q->where('nom_role', 'Administrateur'))
            ->exists();

        return ! $autres;
    }
}
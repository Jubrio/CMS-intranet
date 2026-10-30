<?php

namespace App\Services;

use App\Models\Role;
use App\Models\Utilisateur;

class DroitsUtilisateurs
{
    public function roleAttribuable(Utilisateur $appelant, Role $cible): bool
    {
        $requises = $cible->permissions()->pluck('code_permission');
        $detenues = $appelant->role->permissions()->pluck('code_permission');

        return $requises->diff($detenues)->isEmpty();
    }

    public function peutGerer(Utilisateur $appelant, Utilisateur $cible): bool
    {
        return $this->roleAttribuable($appelant, $cible->role);
    }

    public function estStrictementSuperieur(Utilisateur $appelant, Utilisateur $cible): bool
    {
        $miennes = $appelant->role->permissions()->pluck('code_permission');
        $leurs = $cible->role->permissions()->pluck('code_permission');

        return $leurs->diff($miennes)->isEmpty() && $miennes->diff($leurs)->isNotEmpty();
    }

    public function peutModifierIdentifiants(Utilisateur $appelant, Utilisateur $cible): bool
    {
        if ($appelant->id === $cible->id) {
            return true;
        }
        if ($appelant->role->role_par_defaut && $appelant->role->nom_role === 'Administrateur') {
            return $this->peutGerer($appelant, $cible);
        }

        return $this->estStrictementSuperieur($appelant, $cible);
    }

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

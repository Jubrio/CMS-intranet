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

    // Vrai si l'appelant a toutes les permissions de la cible ET au moins une de plus
    public function estStrictementSuperieur(Utilisateur $appelant, Utilisateur $cible): bool
    {
        $miennes = $appelant->role->permissions()->pluck('code_permission');
        $leurs = $cible->role->permissions()->pluck('code_permission');

        return $leurs->diff($miennes)->isEmpty() && $miennes->diff($leurs)->isNotEmpty();
    }

    // E-mail et mot de passe d'un autre compte : réservés à un niveau strictement supérieur.
    // Exception : l'Administrateur par défaut (toutes les permissions) peut le faire pour un autre
    // Administrateur, sinon un administrateur qui perd son mot de passe ne pourrait jamais être dépanné.
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

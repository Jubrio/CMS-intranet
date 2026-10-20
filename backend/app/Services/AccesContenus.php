<?php

namespace App\Services;

use App\Models\Contenu;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;

class AccesContenus
{
    public function autorise(Utilisateur $u, string $type, string $action): bool
    {
        if (! $u->entreprise_id || ! isset(Contenu::MODULES[$type])) {
            return false; // le Super-administrateur n'a pas accès aux contenus (RG06)
        }
        $module = Contenu::MODULES[$type];

        $actif = DB::table('modules_entreprise')
            ->join('modules', 'modules.id', '=', 'modules_entreprise.module_id')
            ->where('modules_entreprise.entreprise_id', $u->entreprise_id)
            ->where('modules_entreprise.module_actif', true)
            ->where('modules.code_module', $module)
            ->exists();

        return $actif && $u->role->permissions()
            ->where('code_permission', $module.'.'.$action)->exists();
    }

    public function estManager(Utilisateur $u): bool
    {
        return $u->role->role_par_defaut && $u->role->nom_role === 'Manager';
    }

    // RG21 : un Manager ne cible que son propre département
    public function peutCibler(Utilisateur $u, string $visibilite, ?int $departementId): bool
    {
        if (! $this->estManager($u)) {
            return true;
        }

        return $visibilite === 'departement'
            && $u->departement_id !== null
            && (int) $departementId === (int) $u->departement_id;
    }
}

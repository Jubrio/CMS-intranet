<?php

namespace App\Services;

use App\Models\Entreprise;
use App\Models\Permission;
use App\Models\Role;

class RolesParDefautService
{
    public function creerPour(Entreprise $entreprise): void
    {
        $ids = Permission::pluck('id', 'code_permission'); 

        $consulter = $ids->keys()->filter(fn ($code) => str_ends_with($code, '.consulter'))->values()->all();
               $employe = array_merge($consulter, ['formulaires.repondre']);
        $contenus = ['actualites.publier', 'annonces.publier', 'articles.publier', 'notes_service.publier'];

        $manager = array_merge($employe, $contenus, ['documents.gerer', 'evenements.gerer']);
        $rh = array_merge($manager, ['utilisateurs.gerer', 'utilisateurs.departements', 'annuaire.gerer', 'faq.gerer', 'formulaires.gerer']);

        $definitions = [
            'Administrateur' => $ids->keys()->all(),
            'RH' => $rh,
            'Manager' => $manager,
            'Employé' => $employe,
        ];

        foreach ($definitions as $nom => $codes) {
            $role = Role::firstOrCreate(
                ['entreprise_id' => $entreprise->id, 'nom_role' => $nom],
                ['role_par_defaut' => true]
            );
            $role->permissions()->sync(collect($codes)->map(fn ($code) => $ids[$code])->all());
        }
    }
}
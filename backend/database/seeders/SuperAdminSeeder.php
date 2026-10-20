<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Utilisateur;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::firstOrCreate(
            ['entreprise_id' => null, 'nom_role' => 'Super-administrateur'],
            ['role_par_defaut' => true]
        );

        Utilisateur::firstOrCreate(
            ['email' => 'superadmin@rcs.local'],
            [
                'role_id' => $role->id,
                'entreprise_id' => null,
                'nom' => 'Super',
                'prenom' => 'Admin',
                'mot_de_passe' => 'ChangeMoi123!',
                'statut_compte' => 'actif',
            ]
        );
    }
}
<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Utilisateur;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('SUPERADMIN_EMAIL');
        $mdp = env('SUPERADMIN_PASSWORD');

        if (! $email || ! $mdp || strlen($mdp) < 12) {
            throw new \RuntimeException(
                'Définis SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD (12 caractères minimum) dans .env avant de lancer le seeder.'
            );
        }

        $role = Role::firstOrCreate(
            ['entreprise_id' => null, 'nom_role' => 'Super-administrateur'],
            ['role_par_defaut' => true]
        );

        Utilisateur::firstOrCreate(
            ['email' => $email],
            [
                'role_id' => $role->id,
                'entreprise_id' => null,
                'nom' => 'Super',
                'prenom' => 'Admin',
                'mot_de_passe' => $mdp,
                'statut_compte' => 'actif',
            ]
        );
    }
}

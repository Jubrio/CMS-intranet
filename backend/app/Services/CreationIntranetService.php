<?php

namespace App\Services;

use App\Models\Entreprise;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use App\Models\Personnalisation;
use App\Models\Role;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreationIntranetService
{
    public function __construct(private RolesParDefautService $rolesParDefaut) {}

    public function creer(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $entreprise = Entreprise::create([
                'nom_entreprise' => $data['nom_entreprise'],
                'slug' => $this->slugUnique($data['nom_entreprise']),
                'email_contact' => $data['email'],
                'statut_entreprise' => 'active',
            ]);

            $this->rolesParDefaut->creerPour($entreprise);
            $modules = Module::where('module_obligatoire', true)
                ->orWhereIn('code_module', $data['modules'] ?? [])
                ->get();
            foreach ($modules as $module) {
                ModuleEntreprise::create([
                    'entreprise_id' => $entreprise->id,
                    'module_id' => $module->id,
                    'module_actif' => true,
                    'date_activation' => now(),
                ]);
            }

            Personnalisation::create(['entreprise_id' => $entreprise->id]);
            $roleAdmin = Role::where('entreprise_id', $entreprise->id)
                ->where('nom_role', 'Administrateur')->firstOrFail();

            $admin = Utilisateur::create([
                'entreprise_id' => $entreprise->id,
                'role_id' => $roleAdmin->id,
                'nom' => $data['nom'],
                'prenom' => $data['prenom'],
                'email' => $data['email'],
                'mot_de_passe' => $data['mot_de_passe'],
                'statut_compte' => 'actif',
            ]);

            return [$entreprise, $admin, $modules->pluck('code_module')];
        });
    }

    private function slugUnique(string $nom): string
    {
        $base = Str::limit(Str::slug($nom) ?: 'intranet', 40, '');
        $slug = $base;
        $i = 2;
        while (Entreprise::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}

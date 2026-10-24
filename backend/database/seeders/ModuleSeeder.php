<?php

namespace Database\Seeders;

use App\Models\Module;
use App\Models\Permission;
use Illuminate\Database\Seeder;

class ModuleSeeder extends Seeder
{
    public function run(): void
    {
        // [code, nom, description, obligatoire, [[code permission, libellé], ...]]
        $catalogue = [
            ['utilisateurs', 'Utilisateurs', 'Comptes, services et départements', true, [
                ['utilisateurs.gerer', 'Gérer les utilisateurs'],
                ['utilisateurs.departements', 'Gérer les services et départements'],
            ]],
            ['roles', 'Rôles et permissions', 'Gestion des rôles et des droits', true, [
                ['roles.gerer', 'Gérer les rôles et permissions'],
            ]],
            ['personnalisation', 'Personnalisation', 'Paramètres, menus, apparence et choix des modules', true, [
                ['personnalisation.parametres', "Configurer l'espace intranet"],
                ['personnalisation.apparence', "Personnaliser l'apparence"],
                ['personnalisation.modules', "Gérer les modules de l'entreprise"],
            ]],
            ['actualites', 'Actualités', "Actualités de l'entreprise", false, [
                ['actualites.consulter', 'Consulter les actualités'],
                ['actualites.publier', 'Publier des actualités'],
            ]],
            ['annonces', 'Annonces', 'Annonces internes', false, [
                ['annonces.consulter', 'Consulter les annonces'],
                ['annonces.publier', 'Publier des annonces'],
            ]],
            ['articles', 'Articles', 'Articles et publications', false, [
                ['articles.consulter', 'Consulter les articles'],
                ['articles.publier', 'Publier des articles'],
            ]],
            ['notes_service', 'Notes de service', 'Notes de service officielles', false, [
                ['notes_service.consulter', 'Consulter les notes de service'],
                ['notes_service.publier', 'Publier des notes de service'],
            ]],
            ['annuaire', 'Annuaire et organigramme', 'Fiches des employés et organigramme', false, [
                ['annuaire.consulter', "Consulter l'annuaire et l'organigramme"],
                ['annuaire.gerer', "Gérer l'annuaire et l'organigramme"],
            ]],
            ['documents', 'Documents', 'Partage de documents', false, [
                ['documents.consulter', 'Consulter les documents'],
                ['documents.gerer', 'Gérer les documents'],
            ]],
            ['calendrier', 'Calendrier', "Calendrier de l'entreprise", false, [
                ['calendrier.consulter', 'Consulter le calendrier'],
            ]],
            ['evenements', 'Événements', 'Événements internes', false, [
                ['evenements.consulter', 'Consulter les événements'],
                ['evenements.gerer', 'Gérer les événements'],
            ]],
            ['faq', 'FAQ', 'Questions fréquentes', false, [
                ['faq.consulter', 'Consulter la FAQ'],
                ['faq.gerer', 'Gérer la FAQ'],
            ]],
            ['formulaires', 'Formulaires internes', 'Formulaires à remplir', false, [
                ['formulaires.repondre', 'Remplir un formulaire'],
                ['formulaires.gerer', 'Gérer les formulaires'],
            ]],
            ['pages', 'Pages internes', "Pages d'information", false, [
                ['pages.consulter', 'Consulter les pages'],
                ['pages.gerer', 'Gérer les pages'],
            ]],
        ];

        foreach ($catalogue as [$code, $nom, $description, $obligatoire, $permissions]) {
            $module = Module::updateOrCreate(
                ['code_module' => $code],
                ['nom_module' => $nom, 'description_module' => $description, 'module_obligatoire' => $obligatoire]
            );
            foreach ($permissions as [$codePermission, $libelle]) {
                Permission::updateOrCreate(
                    ['code_permission' => $codePermission],
                    ['module_id' => $module->id, 'libelle_permission' => $libelle]
                );
            }
        }
    }
}

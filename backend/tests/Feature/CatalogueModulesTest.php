<?php

namespace Tests\Feature;

use App\Models\Module;
use App\Models\ModuleEntreprise;
use Tests\IntranetTestCase;

class CatalogueModulesTest extends IntranetTestCase
{
    private function nouveauModule(array $surcharge = []): array
    {
        return $surcharge + [
            'code_module' => 'sondages',
            'nom_module' => 'Sondages',
            'description_module' => 'Sondages internes',
            'permissions' => [
                ['code_permission' => 'sondages.consulter', 'libelle_permission' => 'Consulter les sondages'],
                ['code_permission' => 'sondages.gerer', 'libelle_permission' => 'Gérer les sondages'],
            ],
        ];
    }

    public function test_le_super_administrateur_ajoute_un_module_avec_ses_permissions(): void
    {
        $this->connecter($this->superAdmin())
            ->postJson('/api/super/modules', $this->nouveauModule())
            ->assertCreated()
            ->assertJsonPath('code_module', 'sondages')
            ->assertJsonPath('module_obligatoire', false)
            ->assertJsonPath('nb_permissions', 2);

        $this->assertDatabaseHas('permissions', ['code_permission' => 'sondages.gerer']);
        $this->getJson('/api/modules/catalogue')->assertOk()->assertJsonFragment(['code_module' => 'sondages']);
    }

    public function test_un_code_existant_ou_un_champ_manquant_est_refuse(): void
    {
        $this->connecter($this->superAdmin());

        $this->postJson('/api/super/modules', $this->nouveauModule(['code_module' => 'faq']))
            ->assertUnprocessable()->assertJsonValidationErrors('code_module');
        $this->postJson('/api/super/modules', $this->nouveauModule(['nom_module' => '']))
            ->assertUnprocessable()->assertJsonValidationErrors('nom_module');
        $this->postJson('/api/super/modules', $this->nouveauModule([
            'permissions' => [['code_permission' => 'autre.gerer', 'libelle_permission' => 'X']],
        ]))->assertUnprocessable()->assertJsonValidationErrors('permissions.0.code_permission');
    }

    public function test_la_modification_ne_change_pas_le_code(): void
    {
        $this->connecter($this->superAdmin());
        $this->postJson('/api/super/modules', $this->nouveauModule())->assertCreated();

        $this->putJson('/api/super/modules/sondages', [
            'code_module' => 'autre',
            'nom_module' => 'Sondages v2',
            'description_module' => 'Nouvelle description',
        ])->assertOk()->assertJsonPath('code_module', 'sondages')->assertJsonPath('nom_module', 'Sondages v2');
    }

    public function test_la_desactivation_globale_conserve_le_module_des_entreprises_qui_l_utilisent(): void
    {
        $this->connecter($this->superAdmin());
        $this->postJson('/api/super/modules', $this->nouveauModule())->assertCreated();
        [$utilisatrice, $adminU] = $this->creerEntreprise('Utilisatrice', ['sondages']);

        $this->putJson('/api/super/modules/sondages/etat', ['actif_global' => false])
            ->assertOk()->assertJsonPath('actif_global', false);

        // Plus proposé au catalogue public ni aux nouvelles entreprises
        $this->getJson('/api/modules/catalogue')->assertJsonMissing(['code_module' => 'sondages']);
        [$nouvelle] = $this->creerEntreprise('Nouvelle', ['sondages']);
        $this->assertDatabaseMissing('modules_entreprise', [
            'entreprise_id' => $nouvelle->id,
            'module_id' => Module::where('code_module', 'sondages')->value('id'),
        ]);

        // L'entreprise qui l'utilisait le conserve
        $this->assertTrue(ModuleEntreprise::where('entreprise_id', $utilisatrice->id)
            ->where('module_id', Module::where('code_module', 'sondages')->value('id'))
            ->value('module_actif'));

        // Une entreprise qui ne l'avait pas ne peut pas l'activer
        $this->connecter($nouvelle->utilisateurs()->first())
            ->putJson('/api/modules/sondages', ['actif' => true])->assertUnprocessable();
    }

    public function test_un_module_obligatoire_ne_peut_etre_ni_desactive_ni_retire(): void
    {
        $this->connecter($this->superAdmin());

        $this->putJson('/api/super/modules/roles/etat', ['actif_global' => false])->assertUnprocessable();
        $this->deleteJson('/api/super/modules/roles')->assertUnprocessable();
    }

    public function test_le_retrait_d_un_module_utilise_demande_confirmation_et_conserve_les_donnees(): void
    {
        $this->connecter($this->superAdmin());
        $this->postJson('/api/super/modules', $this->nouveauModule())->assertCreated();
        [$entreprise] = $this->creerEntreprise('Utilisatrice', ['sondages']);

        $this->deleteJson('/api/super/modules/sondages')
            ->assertStatus(409)->assertJsonPath('confirmation_requise', true)->assertJsonPath('nb_entreprises', 1);
        $this->assertNull(Module::where('code_module', 'sondages')->value('retire_le'));

        $this->deleteJson('/api/super/modules/sondages', ['confirmer' => true])->assertOk();

        $module = Module::where('code_module', 'sondages')->first();
        $this->assertNotNull($module->retire_le);
        $this->assertDatabaseHas('modules_entreprise', ['entreprise_id' => $entreprise->id, 'module_id' => $module->id]);
        $this->assertDatabaseHas('permissions', ['code_permission' => 'sondages.gerer']);
        $this->getJson('/api/super/modules')->assertJsonMissing(['code_module' => 'sondages']);
    }

    public function test_un_module_non_utilise_se_retire_sans_confirmation(): void
    {
        $this->connecter($this->superAdmin());
        $this->postJson('/api/super/modules', $this->nouveauModule())->assertCreated();

        $this->deleteJson('/api/super/modules/sondages')->assertOk();
    }

    public function test_un_administrateur_d_entreprise_ne_gere_pas_le_catalogue(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        $this->connecter($admin);

        $this->postJson('/api/super/modules', $this->nouveauModule())->assertForbidden();
        $this->putJson('/api/super/modules/faq', ['nom_module' => 'X'])->assertForbidden();
        $this->deleteJson('/api/super/modules/faq')->assertForbidden();
    }
}

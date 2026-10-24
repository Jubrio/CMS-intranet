<?php

namespace Tests\Feature;

use Tests\IntranetTestCase;

class ModulesTest extends IntranetTestCase
{
    public function test_un_module_non_active_refuse_l_acces_meme_avec_la_permission(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha'); // aucun module facultatif

        $this->connecter($admin);
        foreach (['/api/documents', '/api/annuaire', '/api/organigramme', '/api/faq', '/api/evenements', '/api/formulaires', '/api/pages'] as $url) {
            $this->getJson($url)->assertForbidden()->assertJsonPath('message', 'Module désactivé.');
        }
    }

    public function test_activer_puis_desactiver_un_module_ouvre_puis_ferme_ses_routes(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $this->connecter($admin);

        $this->getJson('/api/documents')->assertForbidden();

        $this->putJson('/api/modules/documents', ['actif' => true])->assertOk()->assertJsonPath('actif', true);
        $this->getJson('/api/documents')->assertOk();

        $this->putJson('/api/modules/documents', ['actif' => false])->assertOk()->assertJsonPath('actif', false);
        $this->getJson('/api/documents')->assertForbidden();
    }

    public function test_un_module_obligatoire_ne_peut_pas_etre_desactive(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        foreach (['utilisateurs', 'roles', 'personnalisation'] as $code) {
            $this->connecter($admin)->putJson("/api/modules/{$code}", ['actif' => false])->assertStatus(422);
        }

        $this->getJson('/api/utilisateurs')->assertOk();
    }

    public function test_activer_un_module_chez_soi_ne_l_active_pas_chez_les_autres(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha');
        [, $adminB] = $this->creerEntreprise('Beta');

        $this->connecter($adminA)->putJson('/api/modules/documents', ['actif' => true])->assertOk();

        $this->connecter($adminB)->getJson('/api/documents')->assertForbidden();
    }

    public function test_la_liste_des_modules_reflete_l_etat_de_l_entreprise(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['faq']);

        $etat = collect($this->connecter($admin)->getJson('/api/modules')->assertOk()->json())
            ->pluck('actif', 'code_module');

        $this->assertTrue($etat['faq']);
        $this->assertTrue($etat['utilisateurs']);
        $this->assertFalse($etat['documents']);
    }

    public function test_le_super_administrateur_n_a_aucune_entreprise_donc_pas_de_modules(): void
    {
        $this->connecter($this->superAdmin())->getJson('/api/documents')->assertForbidden();
        $this->getJson('/api/modules')->assertForbidden();
    }
}

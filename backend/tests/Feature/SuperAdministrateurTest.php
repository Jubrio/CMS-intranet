<?php

namespace Tests\Feature;

use App\Models\Role;
use Tests\IntranetTestCase;

class SuperAdministrateurTest extends IntranetTestCase
{
    public function test_le_super_administrateur_voit_toutes_les_entreprises_et_les_totaux(): void
    {
        $this->creerEntreprise('Alpha');
        [$beta] = $this->creerEntreprise('Beta');
        $beta->update(['statut_entreprise' => 'suspendue']);

        $reponse = $this->connecter($this->superAdmin())->getJson('/api/super/intranets')->assertOk();

        $this->assertEqualsCanonicalizing(['Alpha', 'Beta'], collect($reponse->json('data'))->pluck('nom_entreprise')->all());
        $this->assertSame(2, $reponse->json('totaux.entreprises'));
        $this->assertSame(1, $reponse->json('totaux.actives'));
        $this->assertSame(1, $reponse->json('totaux.suspendues'));
        $this->assertSame(2, $reponse->json('totaux.utilisateurs')); // un administrateur par entreprise
    }

    public function test_la_recherche_d_intranets_ignore_la_casse(): void
    {
        $this->creerEntreprise('Alpha Logistique');
        $this->creerEntreprise('Beta');

        $reponse = $this->connecter($this->superAdmin())->getJson('/api/super/intranets?q=LOGISTIQUE')->assertOk();

        $this->assertSame(['Alpha Logistique'], collect($reponse->json('data'))->pluck('nom_entreprise')->all());
    }

    public function test_la_fiche_d_un_intranet_liste_modules_et_administrateurs(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['faq']);

        $reponse = $this->connecter($this->superAdmin())->getJson("/api/super/intranets/{$entreprise->id}")->assertOk();

        $modules = collect($reponse->json('modules'))->pluck('actif', 'code_module');
        $this->assertTrue($modules['faq']);
        $this->assertTrue($modules['utilisateurs']);
        $this->assertFalse($modules['documents']);
        $this->assertSame([$admin->email], collect($reponse->json('administrateurs'))->pluck('email')->all());
    }

    public function test_le_super_administrateur_ne_lit_aucun_contenu_d_entreprise(): void
    {
        $this->creerEntreprise('Alpha', ['documents', 'annuaire']);
        $this->connecter($this->superAdmin());

        foreach (['/api/utilisateurs', '/api/roles', '/api/departements', '/api/documents', '/api/annuaire'] as $url) {
            $this->getJson($url)->assertForbidden();
        }
    }

    public function test_un_administrateur_d_entreprise_n_accede_pas_a_la_plateforme(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');

        $this->connecter($admin)->getJson("/api/super/intranets/{$entreprise->id}")->assertForbidden();
        $this->getJson('/api/super/intranets')->assertForbidden();
    }

    public function test_un_super_administrateur_a_un_nom_de_role_identique_dans_une_entreprise_reste_refuse(): void
    {
        // Le rôle doit être global (entreprise_id nul) ET rattaché à un compte sans entreprise
        [$entreprise] = $this->creerEntreprise('Alpha');
        $role = Role::create(['entreprise_id' => $entreprise->id, 'nom_role' => 'Super-administrateur']);
        $faux = $this->creerUtilisateur($entreprise, 'Employé', ['role_id' => $role->id]);

        $this->connecter($faux)->getJson('/api/super/intranets')->assertForbidden();
    }

    public function test_une_entreprise_suspendue_bloque_ses_comptes_mais_pas_le_super_administrateur(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $jeton = $admin->createToken('test')->plainTextToken;
        $entreprise->update(['statut_entreprise' => 'suspendue']);

        $this->withToken($jeton)->getJson('/api/me')->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->connecter($this->superAdmin())->getJson('/api/me')->assertOk()->assertJsonPath('role', 'Super-administrateur');
    }
}

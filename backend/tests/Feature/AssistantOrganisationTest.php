<?php

namespace Tests\Feature;

use App\Assistant\ToolRegistry;
use App\Assistant\Tools\ChangerStatutUtilisateurTool;
use App\Assistant\Tools\CreerDepartementTool;
use App\Assistant\Tools\ModifierDepartementTool;
use App\Assistant\Tools\ModifierUtilisateurTool;
use App\Assistant\Tools\ReinitialiserMotDePasseTool;
use App\Assistant\Tools\ToolException;
use App\Models\Departement;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Hash;
use Tests\IntranetTestCase;

class AssistantOrganisationTest extends IntranetTestCase
{
    // ---- modifier_utilisateur ---------------------------------------------------

    public function test_l_admin_change_role_et_departement_par_noms(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $outil = app(ModifierUtilisateurTool::class);

        $p = $outil->validate($admin, ['email' => strtoupper($employe->email), 'role' => 'manager', 'departement' => 'finance', 'poste' => 'Chef de caisse']);
        $this->assertStringContainsString('rôle → Manager', $outil->summary($p));
        $outil->execute($admin, $p);

        $employe->refresh();
        $this->assertSame('Manager', $employe->role->nom_role);
        $this->assertSame($finance->id, $employe->departement_id);
        $this->assertSame('Chef de caisse', $employe->poste);
    }

    public function test_un_rh_ne_peut_pas_donner_le_role_administrateur(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $rh = $this->creerUtilisateur($entreprise, 'RH');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->expectException(ToolException::class);
        app(ModifierUtilisateurTool::class)->validate($rh, ['email' => $employe->email, 'role' => 'Administrateur']);
    }

    public function test_un_rh_ne_peut_pas_modifier_un_administrateur(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $rh = $this->creerUtilisateur($entreprise, 'RH');

        $this->expectException(ToolException::class);
        app(ModifierUtilisateurTool::class)->validate($rh, ['email' => $admin->email, 'poste' => 'X']);
    }

    public function test_le_dernier_administrateur_ne_peut_pas_changer_de_role(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('dernier administrateur');
        app(ModifierUtilisateurTool::class)->validate($admin, ['email' => $admin->email, 'role' => 'Employé']);
    }

    public function test_un_compte_d_une_autre_entreprise_est_introuvable(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha');
        [$entrepriseB] = $this->creerEntreprise('Beta');
        $autre = $this->creerUtilisateur($entrepriseB, 'Employé');

        $this->expectException(ToolException::class);
        app(ModifierUtilisateurTool::class)->validate($adminA, ['email' => $autre->email, 'poste' => 'X']);
    }

    public function test_un_email_deja_pris_est_refuse_et_aucun_changement_est_signale(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $a = $this->creerUtilisateur($entreprise, 'Employé');
        $b = $this->creerUtilisateur($entreprise, 'Employé');
        $outil = app(ModifierUtilisateurTool::class);

        try {
            $outil->validate($admin, ['email' => $a->email, 'nouvel_email' => $b->email]);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('déjà utilisée', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('Aucun changement');
        $outil->validate($admin, ['email' => $a->email, 'poste' => $a->poste ?? '']);
    }

    public function test_le_changement_d_email_ferme_les_sessions_de_la_cible(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $employe->createToken('t');
        $outil = app(ModifierUtilisateurTool::class);

        $outil->execute($admin, $outil->validate($admin, ['email' => $employe->email, 'nouvel_email' => 'nouveau@exemple.mg']));

        $this->assertSame('nouveau@exemple.mg', $employe->refresh()->email);
        $this->assertSame(0, $employe->tokens()->count());
    }

    public function test_une_boucle_hierarchique_est_refusee(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $chef = $this->creerUtilisateur($entreprise, 'Manager');
        $employe = $this->creerUtilisateur($entreprise, 'Employé', ['superieur_id' => $chef->id]);

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('boucle');
        app(ModifierUtilisateurTool::class)->validate($admin, ['email' => $chef->email, 'superieur' => $employe->email]);
    }

    public function test_aucun_retire_le_departement(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé', ['departement_id' => $finance->id]);
        $outil = app(ModifierUtilisateurTool::class);

        $outil->execute($admin, $outil->validate($admin, ['email' => $employe->email, 'departement' => 'aucun']));

        $this->assertNull($employe->refresh()->departement_id);
    }

    // ---- changer_statut_utilisateur ---------------------------------------------

    public function test_desactivation_puis_reactivation(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $employe->createToken('t');
        $outil = app(ChangerStatutUtilisateurTool::class);

        $outil->execute($admin, $outil->validate($admin, ['email' => $employe->email, 'actif' => false]));
        $this->assertSame('inactif', $employe->refresh()->statut_compte);
        $this->assertSame(0, $employe->tokens()->count());

        $outil->execute($admin, $outil->validate($admin, ['email' => $employe->email, 'actif' => 'true']));
        $this->assertSame('actif', $employe->refresh()->statut_compte);
    }

    public function test_on_ne_peut_pas_se_desactiver_soi_meme_ni_desactiver_deux_fois(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé', ['statut_compte' => 'inactif']);
        $outil = app(ChangerStatutUtilisateurTool::class);

        try {
            $outil->validate($admin, ['email' => $admin->email, 'actif' => false]);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('propre compte', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('déjà');
        $outil->validate($admin, ['email' => $employe->email, 'actif' => false]);
    }

    // ---- reinitialiser_mot_de_passe ---------------------------------------------

    public function test_reinitialisation_renvoie_le_secret_hors_donnees(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $employe->createToken('t');
        $outil = app(ReinitialiserMotDePasseTool::class);

        $r = $outil->execute($admin, $outil->validate($admin, ['email' => $employe->email]));

        $mdp = $r['secret']['mot_de_passe_temporaire'];
        $this->assertGreaterThanOrEqual(16, strlen($mdp));
        $this->assertTrue(Hash::check($mdp, $employe->refresh()->mot_de_passe));
        $this->assertSame(0, $employe->tokens()->count());
        $this->assertStringNotContainsString($mdp, json_encode($r['donnees']));
    }

    public function test_un_rh_ne_peut_pas_reinitialiser_le_mot_de_passe_d_un_admin(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $rh = $this->creerUtilisateur($entreprise, 'RH');

        $this->expectException(ToolException::class);
        app(ReinitialiserMotDePasseTool::class)->validate($rh, ['email' => $admin->email]);
    }

    // ---- départements -----------------------------------------------------------

    public function test_creation_d_un_departement_avec_parent_et_responsable(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $siege = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Siège']);
        $outil = app(CreerDepartementTool::class);

        $p = $outil->validate($admin, ['nom' => 'Logistique', 'parent' => 'siege', 'responsable' => $admin->email]);
        $outil->execute($admin, $p);

        $d = Departement::where('nom_departement', 'Logistique')->firstOrFail();
        $this->assertSame($entreprise->id, $d->entreprise_id);
        $this->assertSame($siege->id, $d->departement_parent_id);
        $this->assertSame($admin->id, $d->responsable_id);
    }

    public function test_un_nom_de_departement_en_double_est_refuse(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);

        $this->expectException(ToolException::class);
        app(CreerDepartementTool::class)->validate($admin, ['nom' => 'FINANCE']);
    }

    public function test_modification_et_cycle_de_departements(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $a = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'A']);
        $b = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'B', 'departement_parent_id' => $a->id]);
        $outil = app(ModifierDepartementTool::class);

        $outil->execute($admin, $outil->validate($admin, ['departement' => 'b', 'nouveau_nom' => 'Bureau B', 'description' => 'Test']));
        $this->assertSame('Bureau B', $b->refresh()->nom_departement);

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('circulaire');
        $outil->validate($admin, ['departement' => 'A', 'parent' => 'Bureau B']);
    }

    // ---- registre ---------------------------------------------------------------

    public function test_les_outils_visibles_dependent_du_role(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $registre = app(ToolRegistry::class);
        $noms = fn (Utilisateur $u) => collect($registre->schemasPour($u))->pluck('function.name')->all();

        $this->assertEqualsCanonicalizing(
            ['creer_utilisateur', 'modifier_utilisateur', 'changer_statut_utilisateur', 'reinitialiser_mot_de_passe',
                'creer_departement', 'modifier_departement', 'lister_utilisateurs', 'lister_departements'],
            $noms($admin),
        );
        $this->assertSame([], $noms($this->creerUtilisateur($entreprise, 'Employé')));
        $this->assertNotContains('reinitialiser_mot_de_passe', $noms($this->creerUtilisateur($entreprise, 'Manager')));
    }
}

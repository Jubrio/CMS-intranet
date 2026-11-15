<?php

namespace Tests\Feature;

use App\Assistant\Tools\ChangerStatutContenuTool;
use App\Assistant\Tools\ListerContenusTool;
use App\Assistant\Tools\ListerDepartementsTool;
use App\Assistant\Tools\ListerUtilisateursTool;
use App\Assistant\Tools\ModifierContenuTool;
use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Notification;
use Tests\IntranetTestCase;

class AssistantContenusEtListesTest extends IntranetTestCase
{
    private function contenu($entreprise, $auteur, array $en_plus = []): Contenu
    {
        return Contenu::create($en_plus + [
            'entreprise_id' => $entreprise->id, 'auteur_id' => $auteur->id, 'type_contenu' => 'actualite',
            'titre' => 'Fermeture', 'corps' => 'Texte initial.', 'statut_contenu' => 'publie',
            'visibilite' => 'entreprise', 'date_publication' => now(),
        ]);
    }

    // ---- lister_utilisateurs / lister_departements ------------------------------

    public function test_lister_les_utilisateurs_avec_filtres_et_sans_fuite_entre_entreprises(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        [$autre] = $this->creerEntreprise('Beta');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $this->creerUtilisateur($autre, 'Employé');
        $outil = app(ListerUtilisateursTool::class);

        $tous = $outil->execute($admin, $outil->validate($admin, []));
        $this->assertSame(2, $tous['donnees']['total']);

        $filtre = $outil->execute($admin, $outil->validate($admin, ['role' => 'employe', 'recherche' => substr($employe->email, 0, 5)]));
        $this->assertSame(1, $filtre['donnees']['total']);
        $this->assertSame($employe->email, $filtre['donnees']['utilisateurs'][0]['email']);
        $this->assertArrayNotHasKey('mot_de_passe', $filtre['donnees']['utilisateurs'][0]);
    }

    public function test_les_listes_sont_reservees_aux_droits_correspondants(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertFalse(app(ListerUtilisateursTool::class)->authorize($employe));
        $this->assertFalse(app(ListerDepartementsTool::class)->authorize($employe));
        $this->assertFalse(app(ListerUtilisateursTool::class)->requiresConfirmation());
    }

    public function test_lister_les_departements(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $outil = app(ListerDepartementsTool::class);

        $r = $outil->execute($admin, $outil->validate($admin, []));

        $this->assertSame('Finance', $r['donnees']['departements'][0]['nom']);
    }

    // ---- lister_contenus --------------------------------------------------------

    public function test_lister_les_contenus_publies_et_refuser_les_brouillons_a_un_employe(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $c = $this->contenu($entreprise, $admin);
        $this->contenu($entreprise, $admin, ['titre' => 'Brouillon', 'statut_contenu' => 'brouillon']);
        $outil = app(ListerContenusTool::class);

        $r = $outil->execute($admin, $outil->validate($admin, ['type' => 'actualite']));
        $this->assertSame(1, $r['donnees']['total']);
        $this->assertSame($c->id, $r['donnees']['contenus'][0]['id']);

        $b = $outil->execute($admin, $outil->validate($admin, ['type' => 'actualite', 'statut' => 'brouillon']));
        $this->assertSame('Brouillon', $b['donnees']['contenus'][0]['titre']);

        $this->expectException(ToolException::class);
        $outil->validate($employe, ['type' => 'actualite', 'statut' => 'brouillon']);
    }

    // ---- modifier_contenu -------------------------------------------------------

    public function test_modifier_le_texte_et_les_destinataires(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $c = $this->contenu($entreprise, $admin);
        $outil = app(ModifierContenuTool::class);

        $p = $outil->validate($admin, ['type' => 'actualite', 'id' => $c->id, 'corps' => 'Nouveau texte.', 'departement' => 'finance']);
        $this->assertStringContainsString('Nouveau texte.', $outil->summary($p));
        $outil->execute($admin, $p);

        $c->refresh();
        $this->assertSame('Nouveau texte.', $c->corps);
        $this->assertSame('departement', $c->visibilite);
        $this->assertSame($finance->id, $c->departement_id);
        $this->assertSame('Fermeture', $c->titre);
    }

    public function test_un_identifiant_inconnu_ou_d_une_autre_entreprise_est_refuse(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        [$entrepriseB, $adminB] = $this->creerEntreprise('Beta', ['actualites']);
        $autre = $this->contenu($entrepriseB, $adminB);
        $outil = app(ModifierContenuTool::class);

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('lister_contenus');
        $outil->validate($admin, ['type' => 'actualite', 'id' => $autre->id, 'titre' => 'X']);
    }

    public function test_un_manager_ne_gere_que_les_contenus_de_son_departement(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Technique']);
        $manager = $this->creerUtilisateur($entreprise, 'Manager', ['departement_id' => $finance->id]);
        $general = $this->contenu($entreprise, $admin);
        $propre = $this->contenu($entreprise, $admin, ['visibilite' => 'departement', 'departement_id' => $finance->id]);
        $outil = app(ModifierContenuTool::class);

        $ok = $outil->validate($manager, ['type' => 'actualite', 'id' => $propre->id, 'titre' => 'Nouveau titre']);
        $this->assertSame('Nouveau titre', $ok['titre']);

        try {
            $outil->validate($manager, ['type' => 'actualite', 'id' => $general->id, 'titre' => 'X']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('son département', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $outil->validate($manager, ['type' => 'actualite', 'id' => $propre->id, 'departement' => 'Technique']);
    }

    public function test_un_module_desactive_bloque_la_modification(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $note = $this->contenu($entreprise, $admin, ['type_contenu' => 'note_service', 'numero_note' => 'N-1']);

        $this->expectException(ToolException::class);
        app(ModifierContenuTool::class)->validate($admin, ['type' => 'note_service', 'id' => $note->id, 'titre' => 'X']);
    }

    public function test_expiration_et_numero_ne_s_appliquent_qu_au_bon_type(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $c = $this->contenu($entreprise, $admin);

        $this->expectException(ToolException::class);
        app(ModifierContenuTool::class)->validate($admin, ['type' => 'actualite', 'id' => $c->id, 'date_expiration' => now()->addDay()->toDateString()]);
    }

    // ---- changer_statut_contenu -------------------------------------------------

    public function test_archiver_retire_les_notifications_et_publier_un_brouillon_notifie(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $this->creerUtilisateur($entreprise, 'Employé');
        $c = $this->contenu($entreprise, $admin, ['statut_contenu' => 'brouillon', 'date_publication' => null]);
        $outil = app(ChangerStatutContenuTool::class);

        $outil->execute($admin, $outil->validate($admin, ['type' => 'actualite', 'id' => $c->id, 'action' => 'publier']));
        $this->assertSame('publie', $c->refresh()->statut_contenu);
        $this->assertTrue(Notification::where('objet_type', 'actualite')->where('objet_id', $c->id)->exists());

        $outil->execute($admin, $outil->validate($admin, ['type' => 'actualite', 'id' => $c->id, 'action' => 'archiver']));
        $this->assertSame('archive', $c->refresh()->statut_contenu);
        $this->assertFalse(Notification::where('objet_type', 'actualite')->where('objet_id', $c->id)->exists());
    }

    public function test_etats_incoherents_refuses(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $publie = $this->contenu($entreprise, $admin);
        $brouillon = $this->contenu($entreprise, $admin, ['statut_contenu' => 'brouillon']);
        $outil = app(ChangerStatutContenuTool::class);

        foreach ([[$publie->id, 'publier'], [$brouillon->id, 'archiver']] as [$id, $action]) {
            try {
                $outil->validate($admin, ['type' => 'actualite', 'id' => $id, 'action' => $action]);
                $this->fail('Une ToolException était attendue.');
            } catch (ToolException $e) {
                $this->assertNotSame('', $e->getMessage());
            }
        }
        $this->assertTrue(true);
    }

    public function test_un_employe_n_a_acces_a_aucun_outil_de_gestion_de_contenu(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertFalse(app(ModifierContenuTool::class)->authorize($employe));
        $this->assertFalse(app(ChangerStatutContenuTool::class)->authorize($employe));
    }
}

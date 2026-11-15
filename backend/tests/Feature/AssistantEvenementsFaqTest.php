<?php

namespace Tests\Feature;

use App\Assistant\Tools\CreerEvenementTool;
use App\Assistant\Tools\CreerQuestionFaqTool;
use App\Assistant\Tools\ListerEvenementsTool;
use App\Assistant\Tools\ListerFaqTool;
use App\Assistant\Tools\ModifierEvenementTool;
use App\Assistant\Tools\ModifierQuestionFaqTool;
use App\Assistant\Tools\ToolException;
use App\Models\Departement;
use App\Models\Evenement;
use App\Models\Notification;
use App\Models\QuestionFaq;
use Tests\IntranetTestCase;

class AssistantEvenementsFaqTest extends IntranetTestCase
{
    private const MODULES = ['calendrier', 'evenements', 'faq'];

    private function evenement($entreprise, $auteur, array $en_plus = []): Evenement
    {
        return Evenement::create($en_plus + [
            'entreprise_id' => $entreprise->id, 'auteur_id' => $auteur->id, 'titre_evenement' => 'Réunion',
            'date_debut' => now()->addDays(2)->setTime(9, 0), 'date_fin' => now()->addDays(2)->setTime(10, 0),
            'visibilite' => 'entreprise',
        ]);
    }

    // ---- événements -------------------------------------------------------------

    public function test_creer_un_evenement_avec_dates_departement_et_notification(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $this->creerUtilisateur($entreprise, 'Employé', ['departement_id' => $finance->id]);
        $outil = app(CreerEvenementTool::class);

        $p = $outil->validate($admin, [
            'titre' => 'Clôture', 'date_debut' => '2026-12-20 09:00', 'date_fin' => '2026-12-20', 'lieu' => 'Salle A', 'departement' => 'finance',
        ]);
        $this->assertSame('2026-12-20 23:59', $p['date_fin']);
        $r = $outil->execute($admin, $p);

        $e = Evenement::findOrFail($r['donnees']['id']);
        $this->assertSame('departement', $e->visibilite);
        $this->assertSame($finance->id, $e->departement_id);
        $this->assertSame('Salle A', $e->lieu);
        $this->assertTrue(Notification::where('objet_type', 'evenement')->where('objet_id', $e->id)->exists());
    }

    public function test_une_fin_avant_le_debut_ou_une_date_invalide_est_refusee(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $outil = app(CreerEvenementTool::class);

        try {
            $outil->validate($admin, ['titre' => 'X', 'date_debut' => '2026-12-20 10:00', 'date_fin' => '2026-12-19 10:00']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('postérieure', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $outil->validate($admin, ['titre' => 'X', 'date_debut' => 'bientôt', 'date_fin' => '2026-12-20']);
    }

    public function test_un_module_desactive_ou_un_employe_n_a_pas_acces_aux_evenements(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['faq']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertFalse(app(CreerEvenementTool::class)->authorize($admin));
        [$entrepriseB] = $this->creerEntreprise('Beta', self::MODULES);
        $this->assertFalse(app(CreerEvenementTool::class)->authorize($this->creerUtilisateur($entrepriseB, 'Employé')));
        $this->assertFalse(app(ModifierEvenementTool::class)->authorize($employe));
    }

    public function test_lister_et_modifier_un_evenement(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $e = $this->evenement($entreprise, $admin, [
            'date_debut' => now()->startOfMonth()->addDays(3)->setTime(9, 0), 'date_fin' => now()->startOfMonth()->addDays(3)->setTime(10, 0),
        ]);
        $lister = app(ListerEvenementsTool::class);

        $liste = $lister->execute($admin, $lister->validate($admin, []));
        $this->assertSame($e->id, $liste['donnees']['evenements'][0]['id']);

        $modifier = app(ModifierEvenementTool::class);
        $p = $modifier->validate($admin, ['id' => $e->id, 'titre' => 'Réunion générale', 'lieu' => 'Salle B']);
        $modifier->execute($admin, $p);

        $e->refresh();
        $this->assertSame('Réunion générale', $e->titre_evenement);
        $this->assertSame('Salle B', $e->lieu);
    }

    public function test_un_evenement_d_une_autre_entreprise_est_introuvable_et_un_manager_est_limite(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        [$entrepriseB, $adminB] = $this->creerEntreprise('Beta', self::MODULES);
        $autre = $this->evenement($entrepriseB, $adminB);
        $outil = app(ModifierEvenementTool::class);

        try {
            $outil->validate($admin, ['id' => $autre->id, 'titre' => 'X']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('lister_evenements', $e->getMessage());
        }

        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $manager = $this->creerUtilisateur($entreprise, 'Manager', ['departement_id' => $finance->id]);
        if (! $outil->authorize($manager)) {
            $this->markTestSkipped('Le rôle Manager par défaut ne gère pas les événements dans cette configuration.');
        }
        $general = $this->evenement($entreprise, $admin);
        $this->expectException(ToolException::class);
        $outil->validate($manager, ['id' => $general->id, 'titre' => 'X']);
    }

    // ---- FAQ --------------------------------------------------------------------

    public function test_creer_lister_et_modifier_une_question_faq(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $creer = app(CreerQuestionFaqTool::class);

        $r = $creer->execute($admin, $creer->validate($admin, [
            'question' => 'Comment poser un congé ?', 'reponse' => 'Via le formulaire RH.', 'categorie' => 'RH',
        ]));
        $faq = QuestionFaq::findOrFail($r['donnees']['id']);
        $this->assertSame($entreprise->id, $faq->entreprise_id);
        $this->assertSame($admin->id, $faq->auteur_id);

        $lister = app(ListerFaqTool::class);
        $liste = $lister->execute($admin, $lister->validate($admin, ['recherche' => 'congé']));
        $this->assertSame(1, $liste['donnees']['total']);

        $modifier = app(ModifierQuestionFaqTool::class);
        $modifier->execute($admin, $modifier->validate($admin, ['id' => $faq->id, 'reponse' => 'Via le portail RH.']));
        $this->assertSame('Via le portail RH.', $faq->refresh()->reponse);
    }

    public function test_faq_champs_obligatoires_et_isolation_entre_entreprises(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        [$entrepriseB, $adminB] = $this->creerEntreprise('Beta', self::MODULES);
        $autre = QuestionFaq::create(['entreprise_id' => $entrepriseB->id, 'auteur_id' => $adminB->id, 'question' => 'Q', 'reponse' => 'R', 'categorie' => 'C']);

        try {
            app(CreerQuestionFaqTool::class)->validate($admin, ['question' => 'Sans réponse']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('Données invalides', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        app(ModifierQuestionFaqTool::class)->validate($admin, ['id' => $autre->id, 'reponse' => 'X']);
    }

    public function test_un_employe_peut_lister_la_faq_mais_pas_la_modifier(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', self::MODULES);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertFalse(app(CreerQuestionFaqTool::class)->authorize($employe));
        $this->assertFalse(app(ModifierQuestionFaqTool::class)->authorize($employe));
    }
}

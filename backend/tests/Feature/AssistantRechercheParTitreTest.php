<?php

namespace Tests\Feature;

use App\Assistant\Tools\ChangerStatutFormulaireTool;
use App\Assistant\Tools\ChangerStatutPageTool;
use App\Assistant\Tools\ModifierDocumentTool;
use App\Assistant\Tools\ModifierEvenementTool;
use App\Assistant\Tools\ModifierPageTool;
use App\Assistant\Tools\ModifierQuestionFaqTool;
use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use App\Models\Document;
use App\Models\Evenement;
use App\Models\Formulaire;
use App\Models\QuestionFaq;
use Tests\IntranetTestCase;

class AssistantRechercheParTitreTest extends IntranetTestCase
{
    private const MODULES = ['calendrier', 'evenements', 'faq', 'pages', 'documents', 'formulaires'];

    public function test_evenement_retrouve_par_titre_et_modifie(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $e = Evenement::create([
            'entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'titre_evenement' => 'Séminaire annuel',
            'date_debut' => now()->addDays(2)->setTime(9, 0), 'date_fin' => now()->addDays(2)->setTime(10, 0), 'visibilite' => 'entreprise',
        ]);
        $outil = app(ModifierEvenementTool::class);

        $p = $outil->validate($admin, ['titre_actuel' => 'SEMINAIRE', 'lieu' => 'Salle B']);
        $outil->execute($admin, $p);

        $this->assertSame($e->id, $p['id']);
        $this->assertSame('Salle B', $e->refresh()->lieu);
    }

    public function test_faq_retrouvee_par_question(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $q = QuestionFaq::create(['entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'question' => 'Où est la cantine ?', 'reponse' => 'RDC', 'categorie' => 'Général']);
        $outil = app(ModifierQuestionFaqTool::class);

        $outil->execute($admin, $outil->validate($admin, ['titre_actuel' => 'cantine', 'reponse' => 'Au 1er étage']));

        $this->assertSame('Au 1er étage', $q->refresh()->reponse);
    }

    public function test_page_modifiee_et_archivee_par_titre(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $page = Contenu::create([
            'entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'type_contenu' => 'page', 'titre' => 'Charte',
            'corps' => 'Texte.', 'statut_contenu' => 'publie', 'visibilite' => 'entreprise', 'date_publication' => now(),
        ]);

        $m = app(ModifierPageTool::class);
        $m->execute($admin, $m->validate($admin, ['titre_actuel' => 'charte', 'corps' => 'Nouveau texte']));
        $this->assertSame('Nouveau texte', $page->refresh()->corps);

        $s = app(ChangerStatutPageTool::class);
        $s->execute($admin, $s->validate($admin, ['titre_actuel' => 'Charte', 'action' => 'archiver']));
        $this->assertSame('archive', $page->refresh()->statut_contenu);
    }

    public function test_document_et_formulaire_par_titre(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $doc = Document::create([
            'entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'nom_document' => 'Règlement intérieur',
            'fichier' => 'documents/x.pdf', 'type_mime' => 'application/pdf', 'taille_fichier' => 10, 'categorie' => 'RH', 'visibilite' => 'entreprise',
        ]);
        $form = Formulaire::create([
            'entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'titre_formulaire' => 'Satisfaction',
            'champs' => [], 'visibilite' => 'entreprise', 'reponse_unique' => true, 'statut_formulaire' => 'brouillon',
        ]);

        $d = app(ModifierDocumentTool::class);
        $d->execute($admin, $d->validate($admin, ['titre_actuel' => 'reglement', 'categorie' => 'Juridique']));
        $this->assertSame('Juridique', $doc->refresh()->categorie);

        $f = app(ChangerStatutFormulaireTool::class);
        $f->execute($admin, $f->validate($admin, ['titre_actuel' => 'satisfaction', 'action' => 'publier']));
        $this->assertSame('publie', $form->refresh()->statut_formulaire);
    }

    public function test_titre_inconnu_ou_ambigu_est_refuse_et_l_identifiant_reste_utilisable(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $a = QuestionFaq::create(['entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'question' => 'Congés payés ?', 'reponse' => 'R', 'categorie' => 'RH']);
        QuestionFaq::create(['entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'question' => 'Congés maladie ?', 'reponse' => 'R', 'categorie' => 'RH']);
        $outil = app(ModifierQuestionFaqTool::class);

        try {
            $outil->validate($admin, ['titre_actuel' => 'Congés', 'categorie' => 'X']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('Plusieurs éléments', $e->getMessage());
        }
        try {
            $outil->validate($admin, ['titre_actuel' => 'Introuvable', 'categorie' => 'X']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('lister_faq', $e->getMessage());
        }

        $p = $outil->validate($admin, ['id' => $a->id, 'categorie' => 'X']);
        $this->assertSame($a->id, $p['id']);
    }
}

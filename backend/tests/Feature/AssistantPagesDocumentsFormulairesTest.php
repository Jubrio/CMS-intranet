<?php

namespace Tests\Feature;

use App\Assistant\ToolRegistry;
use App\Assistant\Tools\ChangerStatutFormulaireTool;
use App\Assistant\Tools\ChangerStatutPageTool;
use App\Assistant\Tools\CreerPageTool;
use App\Assistant\Tools\ListerDocumentsTool;
use App\Assistant\Tools\ListerFormulairesTool;
use App\Assistant\Tools\ListerPagesTool;
use App\Assistant\Tools\ModifierDocumentTool;
use App\Assistant\Tools\ModifierPageTool;
use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Document;
use App\Models\Formulaire;
use Tests\IntranetTestCase;

class AssistantPagesDocumentsFormulairesTest extends IntranetTestCase
{
    private const MODULES = ['pages', 'documents', 'formulaires'];

    private function page($entreprise, $auteur, array $en_plus = []): Contenu
    {
        return Contenu::create($en_plus + [
            'entreprise_id' => $entreprise->id, 'auteur_id' => $auteur->id, 'type_contenu' => 'page', 'titre' => 'Charte',
            'corps' => 'Texte.', 'statut_contenu' => 'brouillon', 'visibilite' => 'entreprise',
        ]);
    }

    private function document($entreprise, $auteur, array $en_plus = []): Document
    {
        return Document::create($en_plus + [
            'entreprise_id' => $entreprise->id, 'auteur_id' => $auteur->id, 'nom_document' => 'Règlement',
            'fichier' => 'documents/x.pdf', 'type_mime' => 'application/pdf', 'taille_fichier' => 10,
            'categorie' => 'RH', 'visibilite' => 'entreprise',
        ]);
    }

    private function formulaire($entreprise, $auteur, array $en_plus = []): Formulaire
    {
        return Formulaire::create($en_plus + [
            'entreprise_id' => $entreprise->id, 'auteur_id' => $auteur->id, 'titre_formulaire' => 'Satisfaction',
            'champs' => [], 'visibilite' => 'entreprise', 'reponse_unique' => true, 'statut_formulaire' => 'brouillon',
        ]);
    }

    // ---- pages ------------------------------------------------------------------

    public function test_creer_une_page_en_brouillon_puis_la_publier_et_l_archiver(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $creer = app(CreerPageTool::class);

        $r = $creer->execute($admin, $creer->validate($admin, ['titre' => 'Règlement', 'corps' => 'Article 1.']));
        $page = Contenu::findOrFail($r['donnees']['id']);
        $this->assertSame('page', $page->type_contenu);
        $this->assertSame('brouillon', $page->statut_contenu);

        $statut = app(ChangerStatutPageTool::class);
        $statut->execute($admin, $statut->validate($admin, ['id' => $page->id, 'action' => 'publier']));
        $this->assertSame('publie', $page->refresh()->statut_contenu);
        $this->assertNotNull($page->date_publication);

        $statut->execute($admin, $statut->validate($admin, ['id' => $page->id, 'action' => 'archiver']));
        $this->assertSame('archive', $page->refresh()->statut_contenu);
    }

    public function test_modifier_et_lister_les_pages_sans_fuite_entre_entreprises(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        [$entrepriseB, $adminB] = $this->creerEntreprise('Beta', self::MODULES);
        $page = $this->page($entreprise, $admin);
        $autre = $this->page($entrepriseB, $adminB);

        $modifier = app(ModifierPageTool::class);
        $modifier->execute($admin, $modifier->validate($admin, ['id' => $page->id, 'corps' => 'Nouveau.', 'departement' => 'Finance']));
        $page->refresh();
        $this->assertSame('Nouveau.', $page->corps);
        $this->assertSame($finance->id, $page->departement_id);

        $lister = app(ListerPagesTool::class);
        $this->assertSame(1, $lister->execute($admin, $lister->validate($admin, []))['donnees']['total']);

        $this->expectException(ToolException::class);
        $modifier->validate($admin, ['id' => $autre->id, 'titre' => 'X']);
    }

    public function test_etats_incoherents_des_pages_refuses(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $brouillon = $this->page($entreprise, $admin);

        $this->expectException(ToolException::class);
        app(ChangerStatutPageTool::class)->validate($admin, ['id' => $brouillon->id, 'action' => 'archiver']);
    }

    // ---- documents --------------------------------------------------------------

    public function test_lister_et_modifier_un_document(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $doc = $this->document($entreprise, $admin);

        $lister = app(ListerDocumentsTool::class);
        $this->assertSame($doc->id, $lister->execute($admin, $lister->validate($admin, ['recherche' => 'règle']))['donnees']['documents'][0]['id']);

        $modifier = app(ModifierDocumentTool::class);
        $modifier->execute($admin, $modifier->validate($admin, ['id' => $doc->id, 'nom' => 'Règlement 2027', 'categorie' => 'Juridique', 'departement' => 'finance']));
        $doc->refresh();
        $this->assertSame('Règlement 2027', $doc->nom_document);
        $this->assertSame('Juridique', $doc->categorie);
        $this->assertSame($finance->id, $doc->departement_id);
        $this->assertSame('documents/x.pdf', $doc->fichier);
    }

    public function test_un_document_inconnu_ou_sans_changement_est_refuse(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $doc = $this->document($entreprise, $admin);
        $modifier = app(ModifierDocumentTool::class);

        try {
            $modifier->validate($admin, ['id' => 99999, 'nom' => 'X']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('lister_documents', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('Aucun changement');
        $modifier->validate($admin, ['id' => $doc->id, 'nom' => 'Règlement']);
    }

    // ---- formulaires ------------------------------------------------------------

    public function test_publier_puis_cloturer_un_formulaire(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $f = $this->formulaire($entreprise, $admin);
        $outil = app(ChangerStatutFormulaireTool::class);

        $outil->execute($admin, $outil->validate($admin, ['id' => $f->id, 'action' => 'publier']));
        $this->assertSame('publie', $f->refresh()->statut_formulaire);

        $lister = app(ListerFormulairesTool::class);
        $this->assertSame(1, $lister->execute($admin, $lister->validate($admin, ['statut' => 'publie']))['donnees']['total']);

        $outil->execute($admin, $outil->validate($admin, ['id' => $f->id, 'action' => 'cloturer']));
        $this->assertSame('cloture', $f->refresh()->statut_formulaire);

        $this->expectException(ToolException::class);
        $outil->validate($admin, ['id' => $f->id, 'action' => 'cloturer']);
    }

    public function test_une_date_limite_depassee_empeche_la_publication(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $f = $this->formulaire($entreprise, $admin, ['date_limite' => now()->subDays(2)->toDateString()]);

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('date limite');
        app(ChangerStatutFormulaireTool::class)->validate($admin, ['id' => $f->id, 'action' => 'publier']);
    }

    // ---- droits -----------------------------------------------------------------

    public function test_un_employe_ou_un_module_desactive_bloque_ces_outils(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['pages']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertTrue(app(CreerPageTool::class)->authorize($admin));
        $this->assertFalse(app(ModifierDocumentTool::class)->authorize($admin));
        $this->assertFalse(app(ChangerStatutFormulaireTool::class)->authorize($admin));
        $this->assertFalse(app(CreerPageTool::class)->authorize($employe));
    }

    public function test_le_registre_expose_les_nouveaux_outils_selon_les_modules(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', self::MODULES);
        $noms = collect(app(ToolRegistry::class)->schemasPour($admin))->pluck('function.name')->all();

        foreach (['lister_pages', 'creer_page', 'modifier_page', 'changer_statut_page', 'lister_documents', 'modifier_document', 'lister_formulaires', 'changer_statut_formulaire'] as $outil) {
            $this->assertContains($outil, $noms);
        }
    }
}

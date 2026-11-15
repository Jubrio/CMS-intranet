<?php

namespace Tests\Feature;

use App\Assistant\Tools\ChangerStatutContenuTool;
use App\Assistant\Tools\ModifierContenuTool;
use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use Tests\IntranetTestCase;

class AssistantContenusParTitreTest extends IntranetTestCase
{
    private function actualite($entreprise, $auteur, string $titre, array $en_plus = []): Contenu
    {
        return Contenu::create($en_plus + [
            'entreprise_id' => $entreprise->id, 'auteur_id' => $auteur->id, 'type_contenu' => 'actualite', 'titre' => $titre,
            'corps' => 'Texte.', 'statut_contenu' => 'publie', 'visibilite' => 'entreprise', 'date_publication' => now(),
        ]);
    }

    public function test_archiver_par_titre_exact_ou_partiel_sans_tenir_compte_de_la_casse_ni_des_accents(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $c = $this->actualite($entreprise, $admin, 'Pas de travail demain');
        $this->actualite($entreprise, $admin, 'Bienvenue');
        $outil = app(ChangerStatutContenuTool::class);

        $p = $outil->validate($admin, ['type' => 'actualite', 'titre_actuel' => 'PAS DE TRAVAIL DEMAIN', 'action' => 'archiver']);
        $this->assertSame($c->id, $p['id']);

        $partiel = $outil->validate($admin, ['type' => 'actualite', 'titre_actuel' => 'pas de travail', 'action' => 'archiver']);
        $outil->execute($admin, $partiel);
        $this->assertSame('archive', $c->refresh()->statut_contenu);
    }

    public function test_un_titre_inconnu_ou_ambigu_est_refuse_avec_une_aide(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $this->actualite($entreprise, $admin, 'Réunion générale');
        $this->actualite($entreprise, $admin, 'Réunion du personnel');
        $outil = app(ChangerStatutContenuTool::class);

        try {
            $outil->validate($admin, ['type' => 'actualite', 'titre_actuel' => 'Réunion', 'action' => 'archiver']);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('Plusieurs contenus', $e->getMessage());
            $this->assertStringContainsString('identifiant', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('lister_contenus');
        $outil->validate($admin, ['type' => 'actualite', 'titre_actuel' => 'Inexistant', 'action' => 'archiver']);
    }

    public function test_modifier_par_titre_actuel_et_changer_le_titre(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $c = $this->actualite($entreprise, $admin, 'Fermeture');
        $outil = app(ModifierContenuTool::class);

        $outil->execute($admin, $outil->validate($admin, ['type' => 'actualite', 'titre_actuel' => 'fermeture', 'titre' => 'Fermeture annuelle']));

        $this->assertSame('Fermeture annuelle', $c->refresh()->titre);
    }

    public function test_sans_titre_ni_identifiant_la_demande_est_refusee(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites']);

        $this->expectException(ToolException::class);
        app(ChangerStatutContenuTool::class)->validate($admin, ['type' => 'actualite', 'action' => 'archiver']);
    }

    public function test_l_identifiant_reste_utilisable(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $c = $this->actualite($entreprise, $admin, 'Bienvenue');

        $p = app(ChangerStatutContenuTool::class)->validate($admin, ['type' => 'actualite', 'id' => $c->id, 'action' => 'archiver']);

        $this->assertSame($c->id, $p['id']);
    }
}

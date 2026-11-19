<?php

namespace Tests\Feature;

use App\Assistant\AppelsEnTexte;
use App\Assistant\Tools\ChangerStatutUtilisateurTool;
use App\Assistant\Tools\ToolException;
use Tests\IntranetTestCase;

class AssistantDesignationParNomTest extends IntranetTestCase
{
    public function test_un_compte_est_retrouve_par_son_nom_complet_sans_tenir_compte_de_la_casse(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', []);
        $cible = $this->creerUtilisateur($entreprise, 'Employé', ['prenom' => 'Pierre', 'nom' => 'Test', 'email' => 'pierre@alpha.mg']);
        $outil = app(ChangerStatutUtilisateurTool::class);

        foreach (['Pierre Test', 'pierre test', 'Test Pierre', 'pierre'] as $saisie) {
            $p = $outil->validate($admin, ['email' => $saisie, 'actif' => false]);
            $this->assertSame('pierre@alpha.mg', $p['email'], $saisie);
        }
        $outil->execute($admin, $outil->validate($admin, ['email' => 'Pierre Test', 'actif' => false]));
        $this->assertSame('inactif', $cible->refresh()->statut_compte);
    }

    public function test_homonymes_et_inconnus_sont_refuses_avec_aide(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', []);
        $this->creerUtilisateur($entreprise, 'Employé', ['prenom' => 'Jean', 'nom' => 'Rabe', 'email' => 'jean.rabe@alpha.mg']);
        $this->creerUtilisateur($entreprise, 'Employé', ['prenom' => 'Jean', 'nom' => 'Pierre', 'email' => 'jean.pierre@alpha.mg']);
        $outil = app(ChangerStatutUtilisateurTool::class);

        try {
            $outil->validate($admin, ['email' => 'Jean', 'actif' => false]);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('jean.rabe@alpha.mg', $e->getMessage());
            $this->assertStringContainsString('jean.pierre@alpha.mg', $e->getMessage());
        }

        $this->expectException(ToolException::class);
        $this->expectExceptionMessage('lister_utilisateurs');
        $outil->validate($admin, ['email' => 'Personne Inconnue', 'actif' => false]);
    }

    public function test_un_homonyme_d_une_autre_entreprise_est_ignore(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha', []);
        [$entrepriseB] = $this->creerEntreprise('Beta', []);
        $this->creerUtilisateur($entrepriseB, 'Employé', ['prenom' => 'Pierre', 'nom' => 'Test', 'email' => 'pierre@beta.mg']);

        $this->expectException(ToolException::class);
        app(ChangerStatutUtilisateurTool::class)->validate($adminA, ['email' => 'Pierre Test', 'actif' => false]);
    }

    public function test_appel_precede_d_une_phrase(): void
    {
        $r = AppelsEnTexte::extraire(
            'Changer le statut du compte en inactif : {"name": "changer_statut_utilisateur", "arguments": {"email": "Pierre Test", "actif": false}}',
            ['changer_statut_utilisateur']
        );

        $this->assertSame('changer_statut_utilisateur', $r[0]['function']['name']);
        $this->assertFalse($r[0]['function']['arguments']['actif']);
    }
}

<?php

namespace Tests\Feature;

use App\Assistant\Tools\CreerUtilisateurTool;
use App\Assistant\Tools\ToolException;
use App\Models\Departement;
use App\Models\Utilisateur;
use Tests\IntranetTestCase;

class AssistantCreerUtilisateurTest extends IntranetTestCase
{
    private function outil(): CreerUtilisateurTool
    {
        return app(CreerUtilisateurTool::class);
    }

    public function test_un_administrateur_cree_un_utilisateur_avec_role_et_departement(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);

        $params = $this->outil()->validate($admin, [
            'nom' => 'Rakoto', 'prenom' => 'Jean', 'email' => 'rakoto@exemple.mg',
            'role' => 'rh', 'departement' => 'finance',
        ]);
        $resultat = $this->outil()->execute($admin, $params);

        $cree = Utilisateur::where('email', 'rakoto@exemple.mg')->firstOrFail();
        $this->assertSame($entreprise->id, $cree->entreprise_id);
        $this->assertSame('RH', $cree->role->nom_role);
        $this->assertSame('Finance', $cree->departement->nom_departement);
        $this->assertSame('actif', $cree->statut_compte);
        $this->assertNotEmpty($resultat['secret']['mot_de_passe_temporaire']);
        $this->assertArrayNotHasKey('mot_de_passe_temporaire', $resultat['donnees']);
    }

    public function test_les_accents_sont_tolerees_dans_le_nom_du_role(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $params = $this->outil()->validate($admin, [
            'nom' => 'Rabe', 'prenom' => 'Lala', 'email' => 'lala@exemple.mg', 'role' => 'Employe',
        ]);

        $this->assertSame('Employé', $params['role']);
    }

    public function test_un_role_inconnu_renvoie_la_liste_des_roles_disponibles(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        try {
            $this->outil()->validate($admin, [
                'nom' => 'Rabe', 'prenom' => 'Lala', 'email' => 'lala@exemple.mg', 'role' => 'Directeur',
            ]);
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('Rôles disponibles', $e->getMessage());
            $this->assertStringContainsString('Manager', $e->getMessage());
        }
    }

    public function test_un_employe_n_a_pas_acces_a_l_outil(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertFalse($this->outil()->authorize($employe));
    }

    public function test_un_rh_ne_peut_pas_creer_un_administrateur(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $rh = $this->creerUtilisateur($entreprise, 'RH');

        $this->assertTrue($this->outil()->authorize($rh));
        $this->expectException(ToolException::class);
        $this->outil()->validate($rh, [
            'nom' => 'Rabe', 'prenom' => 'Lala', 'email' => 'lala@exemple.mg', 'role' => 'Administrateur',
        ]);
    }

    public function test_un_email_deja_utilise_est_refuse(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $existant = $this->creerUtilisateur($entreprise, 'Employé');

        $this->expectException(ToolException::class);
        $this->outil()->validate($admin, [
            'nom' => 'Rabe', 'prenom' => 'Lala', 'email' => $existant->email, 'role' => 'Employé',
        ]);
    }

    public function test_un_departement_d_une_autre_entreprise_est_introuvable(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha');
        [$entrepriseB] = $this->creerEntreprise('Beta');
        Departement::create(['entreprise_id' => $entrepriseB->id, 'nom_departement' => 'Secret B']);

        $this->expectException(ToolException::class);
        $this->outil()->validate($adminA, [
            'nom' => 'Rabe', 'prenom' => 'Lala', 'email' => 'lala@exemple.mg',
            'role' => 'Employé', 'departement' => 'Secret B',
        ]);
    }
}

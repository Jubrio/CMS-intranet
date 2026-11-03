<?php

namespace Tests\Feature;

use App\Models\Contenu;
use App\Models\Utilisateur;
use Tests\IntranetTestCase;

class SuppressionCompteTest extends IntranetTestCase
{
    public function test_un_administrateur_supprime_un_compte_sans_historique(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->connecter($admin)->deleteJson("/api/utilisateurs/{$employe->id}")->assertOk();

        $this->assertDatabaseMissing('utilisateurs', ['id' => $employe->id]);
    }

    public function test_un_compte_auteur_de_contenu_ne_peut_etre_que_desactive(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $rh = $this->creerUtilisateur($entreprise, 'RH');
        Contenu::create([
            'entreprise_id' => $entreprise->id,
            'auteur_id' => $rh->id,
            'type_contenu' => 'actualite',
            'titre' => 'Bienvenue',
            'corps' => 'Texte',
            'statut_contenu' => 'brouillon',
            'visibilite' => 'entreprise',
        ]);

        $this->connecter($admin)->deleteJson("/api/utilisateurs/{$rh->id}")
            ->assertStatus(409)->assertJsonPath('desactivation_conseillee', true);
        $this->assertDatabaseHas('utilisateurs', ['id' => $rh->id]);
    }

    public function test_on_ne_supprime_ni_son_propre_compte_ni_le_dernier_administrateur(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $this->connecter($admin)->deleteJson("/api/utilisateurs/{$admin->id}")->assertUnprocessable();
        $this->assertDatabaseHas('utilisateurs', ['id' => $admin->id]);
    }

    public function test_on_ne_supprime_pas_un_compte_d_une_autre_entreprise(): void
    {
        [, $adminAlpha] = $this->creerEntreprise('Alpha');
        [$beta] = $this->creerEntreprise('Beta');
        $employeBeta = $this->creerUtilisateur($beta, 'Employé');

        $this->connecter($adminAlpha)->deleteJson("/api/utilisateurs/{$employeBeta->id}")->assertNotFound();
        $this->assertDatabaseHas('utilisateurs', ['id' => $employeBeta->id]);
    }

    public function test_le_rh_gere_les_fiches_depuis_l_annuaire(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['annuaire']);
        $rh = $this->creerUtilisateur($entreprise, 'RH');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $autre = $this->creerUtilisateur($entreprise, 'Employé');
        $this->connecter($rh);

        $this->putJson("/api/annuaire/{$employe->id}/statut", ['actif' => false])->assertOk();
        $this->assertSame('inactif', Utilisateur::find($employe->id)->statut_compte);

        $this->deleteJson("/api/annuaire/{$autre->id}")->assertOk();
        $this->assertDatabaseMissing('utilisateurs', ['id' => $autre->id]);
    }
}

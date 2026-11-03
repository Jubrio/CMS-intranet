<?php

namespace Tests\Feature;

use App\Models\Entreprise;
use App\Models\JournalOperation;
use App\Models\Utilisateur;
use Tests\IntranetTestCase;

class SuppressionEntrepriseTest extends IntranetTestCase
{
    public function test_la_suppression_exige_l_adresse_de_l_entreprise_en_confirmation(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $this->connecter($this->superAdmin());

        $this->deleteJson("/api/super/intranets/{$entreprise->id}")->assertUnprocessable();
        $this->deleteJson("/api/super/intranets/{$entreprise->id}", ['confirmation' => 'autre'])->assertUnprocessable();
        $this->assertDatabaseHas('entreprises', ['id' => $entreprise->id]);
    }

    public function test_la_suppression_efface_l_entreprise_ses_donnees_et_laisse_les_autres_intactes(): void
    {
        [$alpha, $adminAlpha] = $this->creerEntreprise('Alpha', ['faq', 'documents']);
        [$beta, $adminBeta] = $this->creerEntreprise('Beta', ['faq']);
        $this->creerUtilisateur($alpha, 'Employé');

        $this->connecter($this->superAdmin())
            ->deleteJson("/api/super/intranets/{$alpha->id}", ['confirmation' => $alpha->slug])
            ->assertOk();

        $this->assertDatabaseMissing('entreprises', ['id' => $alpha->id]);
        $this->assertSame(0, Utilisateur::where('entreprise_id', $alpha->id)->count());
        $this->assertDatabaseMissing('roles', ['entreprise_id' => $alpha->id]);
        $this->assertDatabaseHas('entreprises', ['id' => $beta->id]);
        $this->assertDatabaseHas('utilisateurs', ['id' => $adminBeta->id]);
    }

    public function test_les_operations_sont_journalisees_et_la_trace_survit_a_la_suppression(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $super = $this->superAdmin();
        $this->connecter($super);

        $this->putJson("/api/super/intranets/{$entreprise->id}/statut", ['statut' => 'suspendue'])->assertOk();
        $this->putJson("/api/super/intranets/{$entreprise->id}/statut", ['statut' => 'active'])->assertOk();
        $this->deleteJson("/api/super/intranets/{$entreprise->id}", ['confirmation' => $entreprise->slug])->assertOk();

        $actions = JournalOperation::where('cible_type', 'entreprise')->where('cible_id', $entreprise->id)
            ->orderBy('id')->pluck('action')->all();
        $this->assertSame(['suspendre', 'reactiver', 'supprimer'], $actions);
        $this->assertSame($super->id, JournalOperation::first()->utilisateur_id);

        $this->getJson('/api/super/journal')->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_un_administrateur_d_entreprise_ne_peut_pas_supprimer_une_entreprise(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $this->connecter($admin)
            ->deleteJson("/api/super/intranets/{$entreprise->id}", ['confirmation' => $entreprise->slug])
            ->assertForbidden();
        $this->assertTrue(Entreprise::whereKey($entreprise->id)->exists());
    }
}

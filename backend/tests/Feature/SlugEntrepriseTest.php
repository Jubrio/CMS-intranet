<?php

namespace Tests\Feature;

use Tests\IntranetTestCase;

class SlugEntrepriseTest extends IntranetTestCase
{
    public function test_l_administrateur_modifie_l_adresse_de_son_intranet(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');

        $this->connecter($admin)->putJson('/api/entreprise', ['slug' => 'alpha-madagascar'])
            ->assertOk()->assertJsonPath('slug', 'alpha-madagascar');
        $this->assertDatabaseHas('entreprises', ['id' => $entreprise->id, 'slug' => 'alpha-madagascar']);
    }

    public function test_une_adresse_deja_utilisee_ou_invalide_est_refusee(): void
    {
        [, $adminAlpha] = $this->creerEntreprise('Alpha');
        [$beta] = $this->creerEntreprise('Beta');

        $this->connecter($adminAlpha);
        $this->putJson('/api/entreprise', ['slug' => $beta->slug])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->putJson('/api/entreprise', ['slug' => 'Mauvaise Adresse!'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    public function test_conserver_sa_propre_adresse_n_est_pas_un_conflit(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');

        $this->connecter($admin)->putJson('/api/entreprise', ['slug' => $entreprise->slug])->assertOk();
    }
}

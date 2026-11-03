<?php

namespace Tests\Feature;

use App\Models\Contenu;
use Tests\IntranetTestCase;

class FiltresContenusTest extends IntranetTestCase
{
    private function publier($entreprise, $auteur, string $titre, ?string $categorie, string $corps = 'Texte'): void
    {
        Contenu::create([
            'entreprise_id' => $entreprise->id,
            'auteur_id' => $auteur->id,
            'type_contenu' => 'actualite',
            'titre' => $titre,
            'corps' => $corps,
            'categorie' => $categorie,
            'statut_contenu' => 'publie',
            'visibilite' => 'entreprise',
            'date_publication' => now(),
        ]);
    }

    public function test_le_fil_se_filtre_par_categorie_et_par_recherche(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $this->publier($entreprise, $admin, 'Congés d\'été', 'RH');
        $this->publier($entreprise, $admin, 'Nouvelle imprimante', 'IT', 'Installée au 2e étage');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $this->connecter($employe);

        $reponse = $this->getJson('/api/fil?categorie=RH')->assertOk();
        $this->assertSame(['Congés d\'été'], collect($reponse->json('data'))->pluck('titre')->all());
        $this->assertEqualsCanonicalizing(['IT', 'RH'], $reponse->json('categories'));

        $reponse = $this->getJson('/api/fil?q=ÉTAGE')->assertOk();
        $this->assertSame(['Nouvelle imprimante'], collect($reponse->json('data'))->pluck('titre')->all());

        $this->getJson('/api/fil?q=introuvable')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_les_categories_d_une_autre_entreprise_ne_fuitent_pas(): void
    {
        [$alpha, $adminAlpha] = $this->creerEntreprise('Alpha', ['actualites']);
        [$beta, $adminBeta] = $this->creerEntreprise('Beta', ['actualites']);
        $this->publier($beta, $adminBeta, 'Secret Beta', 'Confidentiel');
        $this->publier($alpha, $adminAlpha, 'Public Alpha', 'Général');

        $reponse = $this->connecter($adminAlpha)->getJson('/api/fil?q=Secret')->assertOk();
        $this->assertCount(0, $reponse->json('data'));
        $this->assertSame(['Général'], $this->getJson('/api/fil')->json('categories'));
    }

    public function test_la_liste_par_type_accepte_aussi_les_filtres(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $this->publier($entreprise, $admin, 'Alpha un', 'RH');
        $this->publier($entreprise, $admin, 'Alpha deux', 'IT');

        $reponse = $this->connecter($admin)->getJson('/api/contenus/actualite?categorie=IT')->assertOk();
        $this->assertSame(['Alpha deux'], collect($reponse->json('data'))->pluck('titre')->all());
    }
}

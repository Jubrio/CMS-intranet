<?php

namespace Tests\Feature;

use App\Models\Departement;
use App\Models\Entreprise;
use App\Models\Utilisateur;
use Tests\IntranetTestCase;

/**
 * Recherche de l'annuaire (étape 1) : découpe en mots, ilike, filtre de département,
 * pagination. Ces tests exigent PostgreSQL.
 */
class AnnuaireRechercheTest extends IntranetTestCase
{
    private Entreprise $entreprise;

    private Utilisateur $employe;

    private Departement $compta;

    private Departement $it;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->entreprise] = $this->creerEntreprise('Alpha', ['annuaire']);
        $this->compta = Departement::create(['entreprise_id' => $this->entreprise->id, 'nom_departement' => 'Comptabilité']);
        $this->it = Departement::create(['entreprise_id' => $this->entreprise->id, 'nom_departement' => 'Informatique']);

        $this->personne('Rakoto', 'Jean', 'Comptable', $this->compta);
        $this->personne('Dupont', 'Jeanne', 'Développeuse', $this->it);
        $this->personne('Rakoto', 'Paul', 'Technicien', $this->it);
        $this->personne('Rakoto', 'Marie', 'Comptable', $this->compta, ['statut_compte' => 'inactif']);

        $this->employe = $this->creerUtilisateur($this->entreprise, 'Employé', ['nom' => 'Zafy', 'prenom' => 'Lova']);
    }

    private function personne(string $nom, string $prenom, string $poste, Departement $departement, array $extra = []): Utilisateur
    {
        return $this->creerUtilisateur($this->entreprise, 'Employé', $extra + [
            'nom' => $nom, 'prenom' => $prenom, 'poste' => $poste, 'departement_id' => $departement->id,
        ]);
    }

    private function rechercher(string $q = '', array $filtres = []): array
    {
        $reponse = $this->connecter($this->employe)
            ->getJson('/api/annuaire?'.http_build_query(array_filter(['q' => $q] + $filtres, fn ($v) => $v !== '')))
            ->assertOk();

        return collect($reponse->json('data'))
            ->map(fn ($p) => $p['prenom'].' '.$p['nom'])->sort()->values()->all();
    }

    public function test_sans_recherche_tous_les_comptes_actifs_sont_listes_par_nom(): void
    {
        $reponse = $this->connecter($this->employe)->getJson('/api/annuaire')->assertOk();

        $liste = collect($reponse->json('data'));
        $this->assertSame(5, $reponse->json('total')); // l'administrateur, Jean, Jeanne, Paul et Zafy ; Marie est inactive
        $this->assertNotContains('Marie', $liste->pluck('prenom')->all());

        $noms = $liste->pluck('nom')->filter(fn ($n) => in_array($n, ['Dupont', 'Rakoto', 'Zafy'], true))->values()->all();
        $this->assertSame(['Dupont', 'Rakoto', 'Rakoto', 'Zafy'], $noms);
    }

    public function test_un_seul_mot_cherche_dans_nom_prenom_poste_et_departement(): void
    {
        $this->assertSame(['Jean Rakoto', 'Paul Rakoto'], $this->rechercher('rakoto'));
        $this->assertSame(['Jean Rakoto', 'Jeanne Dupont'], $this->rechercher('jean'));
        $this->assertSame(['Jean Rakoto'], $this->rechercher('comptable'));   // poste
        $this->assertSame(['Jean Rakoto'], $this->rechercher('compta'));      // département (+ poste)
        $this->assertSame(['Jeanne Dupont', 'Paul Rakoto'], $this->rechercher('informatique'));
    }

    public function test_la_recherche_ignore_la_casse(): void
    {
        $this->assertSame(['Jean Rakoto', 'Paul Rakoto'], $this->rechercher('RAKOTO'));
        $this->assertSame(['Jean Rakoto', 'Paul Rakoto'], $this->rechercher('RaKoTo'));
    }

    public function test_plusieurs_mots_doivent_tous_se_retrouver(): void
    {
        $this->assertSame(['Jean Rakoto'], $this->rechercher('jean rakoto'));
        $this->assertSame(['Jean Rakoto'], $this->rechercher('rakoto jean'));       // ordre indifférent
        $this->assertSame(['Jean Rakoto'], $this->rechercher('  jean   rakoto  ')); // espaces multiples
        $this->assertSame(['Paul Rakoto'], $this->rechercher('rakoto informatique')); // nom + département
        $this->assertSame([], $this->rechercher('paul dupont'));                    // aucun compte ne cumule
    }

    public function test_seuls_les_cinq_premiers_mots_comptent(): void
    {
        // Le sixième mot, qui ne correspond à rien, est ignoré
        $this->assertSame(['Jean Rakoto'], $this->rechercher('jean rakoto jean rakoto jean introuvable'));
        // Alors qu'au cinquième rang il bloque la recherche
        $this->assertSame([], $this->rechercher('jean rakoto jean rakoto introuvable'));
    }

    public function test_les_jokers_sql_sont_traites_comme_du_texte(): void
    {
        $this->assertSame([], $this->rechercher('%'));
        $this->assertSame([], $this->rechercher('_'));
        $this->assertSame([], $this->rechercher('ja_n'));
        $this->assertSame([], $this->rechercher('rak%to'));
    }

    public function test_le_filtre_de_departement_se_combine_a_la_recherche(): void
    {
        $this->assertSame(['Jeanne Dupont', 'Paul Rakoto'], $this->rechercher('', ['departement_id' => $this->it->id]));
        $this->assertSame(['Paul Rakoto'], $this->rechercher('rakoto', ['departement_id' => $this->it->id]));
        $this->assertSame([], $this->rechercher('dupont', ['departement_id' => $this->compta->id]));
    }

    public function test_les_resultats_sont_pagines_par_vingt(): void
    {
        for ($i = 1; $i <= 22; $i++) {
            $this->personne('Foule'.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'Test', 'Agent', $this->it);
        }

        $page1 = $this->connecter($this->employe)->getJson('/api/annuaire?q=foule')->assertOk();
        $this->assertSame(22, $page1->json('total'));
        $this->assertCount(20, $page1->json('data'));
        $this->assertSame(2, $page1->json('last_page'));

        $page2 = $this->getJson('/api/annuaire?q=foule&page=2')->assertOk();
        $this->assertCount(2, $page2->json('data'));
    }

    public function test_une_recherche_trop_longue_est_refusee(): void
    {
        $this->connecter($this->employe)->getJson('/api/annuaire?q='.str_repeat('a', 101))
            ->assertStatus(422)->assertJsonValidationErrors('q');
    }

    public function test_la_liste_n_expose_ni_mot_de_passe_ni_donnees_sensibles(): void
    {
        $premier = $this->connecter($this->employe)->getJson('/api/annuaire')->json('data.0');

        $this->assertEqualsCanonicalizing(
            ['id', 'nom', 'prenom', 'email', 'telephone', 'poste', 'photo', 'departement_id', 'nom_departement'],
            array_keys($premier)
        );
    }

    public function test_la_fiche_donne_le_superieur_actif_et_l_equipe_directe(): void
    {
        $chef = $this->personne('Chef', 'Cheryl', 'Directrice', $this->it);
        $inactif = $this->personne('Parti', 'Pierre', 'Ancien', $this->it, ['statut_compte' => 'inactif']);
        $membre = $this->personne('Equipier', 'Eric', 'Agent', $this->it, ['superieur_id' => $chef->id]);
        $this->personne('Absent', 'Alice', 'Agent', $this->it, ['superieur_id' => $chef->id, 'statut_compte' => 'inactif']);
        $orphelin = $this->personne('Orphelin', 'Olivier', 'Agent', $this->it, ['superieur_id' => $inactif->id]);

        $this->connecter($this->employe);

        $fiche = $this->getJson("/api/annuaire/{$chef->id}")->assertOk();
        $this->assertSame([$membre->id], collect($fiche->json('subordonnes'))->pluck('id')->all()); // l'inactive n'y est pas
        $this->assertNull($fiche->json('superieur'));

        $this->getJson("/api/annuaire/{$membre->id}")->assertOk()->assertJsonPath('superieur.id', $chef->id);

        // Un supérieur désactivé n'est pas affiché
        $this->getJson("/api/annuaire/{$orphelin->id}")->assertOk()->assertJsonPath('superieur', null);

        // Un compte désactivé n'a pas de fiche
        $this->getJson("/api/annuaire/{$inactif->id}")->assertNotFound();
    }

    public function test_l_organigramme_compte_les_effectifs_actifs_par_departement(): void
    {
        $arbre = collect($this->connecter($this->employe)->getJson('/api/organigramme')->assertOk()->json())
            ->pluck('nb_employes', 'nom_departement');

        $this->assertSame(1, $arbre['Comptabilité']);  // Marie est inactive
        $this->assertSame(2, $arbre['Informatique']);
    }

    public function test_l_annuaire_est_ferme_si_le_module_est_desactive(): void
    {
        $this->basculerModule($this->entreprise, 'annuaire', false);

        $this->connecter($this->employe)->getJson('/api/annuaire')->assertForbidden();
        $this->getJson('/api/organigramme')->assertForbidden();
    }
}

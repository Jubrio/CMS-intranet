<?php

namespace Tests\Feature;

use App\Assistant\Tools\PublierContenuTool;
use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Notification;
use Tests\IntranetTestCase;

class AssistantPublierContenuTest extends IntranetTestCase
{
    private function outil(): PublierContenuTool
    {
        return app(PublierContenuTool::class);
    }

    private function actualite(array $en_plus = []): array
    {
        return $en_plus + ['type' => 'actualite', 'titre' => 'Fermeture de fin d\'année', 'corps' => 'Les bureaux seront fermés le 25 décembre.'];
    }

    public function test_un_administrateur_publie_une_actualite_pour_toute_l_entreprise_et_notifie(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $this->creerUtilisateur($entreprise, 'Employé');

        $params = $this->outil()->validate($admin, $this->actualite());
        $resultat = $this->outil()->execute($admin, $params);

        $contenu = Contenu::findOrFail($resultat['donnees']['id']);
        $this->assertSame('publie', $contenu->statut_contenu);
        $this->assertSame('entreprise', $contenu->visibilite);
        $this->assertSame($admin->id, $contenu->auteur_id);
        $this->assertNotNull($contenu->date_publication);
        $this->assertTrue(Notification::where('objet_type', 'actualite')->where('objet_id', $contenu->id)->exists());
        $this->assertNull($resultat['secret']);
    }

    public function test_un_brouillon_n_est_ni_publie_ni_notifie(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $this->creerUtilisateur($entreprise, 'Employé');

        $params = $this->outil()->validate($admin, $this->actualite(['brouillon' => true]));
        $resultat = $this->outil()->execute($admin, $params);

        $contenu = Contenu::findOrFail($resultat['donnees']['id']);
        $this->assertSame('brouillon', $contenu->statut_contenu);
        $this->assertNull($contenu->date_publication);
        $this->assertFalse(Notification::where('objet_type', 'actualite')->where('objet_id', $contenu->id)->exists());
    }

    public function test_la_publication_peut_cibler_un_departement(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);

        $params = $this->outil()->validate($admin, $this->actualite(['departement' => 'finance']));
        $resultat = $this->outil()->execute($admin, $params);

        $contenu = Contenu::findOrFail($resultat['donnees']['id']);
        $this->assertSame('departement', $contenu->visibilite);
        $this->assertSame($finance->id, $contenu->departement_id);
    }

    public function test_un_departement_inconnu_renvoie_la_liste(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);

        try {
            $this->outil()->validate($admin, $this->actualite(['departement' => 'Marketing']));
            $this->fail('Une ToolException était attendue.');
        } catch (ToolException $e) {
            $this->assertStringContainsString('Départements disponibles : Finance', $e->getMessage());
        }
    }

    public function test_un_module_desactive_n_est_pas_publiable(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $this->assertFalse($this->outil()->authorize($admin));
        $this->expectException(ToolException::class);
        $this->outil()->validate($admin, $this->actualite());
    }

    public function test_un_employe_n_a_pas_acces_a_l_outil(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertFalse($this->outil()->authorize($employe));
    }

    public function test_un_manager_ne_publie_que_pour_son_departement(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Technique']);
        $manager = $this->creerUtilisateur($entreprise, 'Manager', ['departement_id' => $finance->id]);

        $ok = $this->outil()->validate($manager, $this->actualite(['departement' => 'Finance']));
        $this->assertSame($finance->id, $ok['departement_id']);

        $this->expectException(ToolException::class);
        $this->outil()->validate($manager, $this->actualite(['departement' => 'Technique']));
    }

    public function test_un_manager_ne_peut_pas_publier_pour_toute_l_entreprise(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        $manager = $this->creerUtilisateur($entreprise, 'Manager', ['departement_id' => $finance->id]);

        $this->expectException(ToolException::class);
        $this->outil()->validate($manager, $this->actualite());
    }

    public function test_la_date_d_expiration_n_existe_que_pour_les_annonces(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites', 'annonces']);
        $demain = now()->addDay()->toDateString();

        $annonce = $this->outil()->validate($admin, [
            'type' => 'annonce', 'titre' => 'Parking', 'corps' => 'Le parking ferme.', 'date_expiration' => $demain,
        ]);
        $this->assertSame($demain, $annonce['date_expiration']);

        $this->expectException(ToolException::class);
        $this->outil()->validate($admin, $this->actualite(['date_expiration' => $demain]));
    }

    public function test_un_type_inconnu_est_refuse(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites']);

        $this->expectException(ToolException::class);
        $this->outil()->validate($admin, $this->actualite(['type' => 'page']));
    }
}

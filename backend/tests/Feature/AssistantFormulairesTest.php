<?php

namespace Tests\Feature;

use App\Assistant\Formulaires;
use App\Assistant\AgentService;
use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use App\Models\Departement;
use Illuminate\Support\Facades\Http;
use Tests\IntranetTestCase;

class AssistantFormulairesTest extends IntranetTestCase
{
    private function formulaires(): Formulaires
    {
        return app(Formulaires::class);
    }

    private function champ(array $formulaire, string $nom): ?array
    {
        foreach ($formulaire['champs'] as $champ) {
            if ($champ['nom'] === $nom) {
                return $champ;
            }
        }

        return null;
    }

    public function test_le_formulaire_de_publication_liste_les_departements_et_ignore_les_valeurs_inventees(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Technique']);

        $f = $this->formulaires()->construire($admin, 'publier_contenu', ['type' => 'actualite', 'titre' => 'Test', 'corps' => 'Texte', 'departement' => 'aucun']);

        $this->assertSame('Test', $f['valeurs']['titre']);
        $this->assertArrayNotHasKey('departement', $f['valeurs']); // « aucun » n'est pas un département
        $this->assertSame(['Finance', 'Technique'], array_column($this->champ($f, 'departement')['options'], 'valeur'));
        $this->assertSame("Toute l'entreprise", $this->champ($f, 'departement')['vide']);
        $this->assertSame('oui_non', $this->champ($f, 'brouillon')['type']);

        $f2 = $this->formulaires()->construire($admin, 'publier_contenu', ['departement' => 'finance']);
        $this->assertSame('Finance', $f2['valeurs']['departement']);
    }

    public function test_une_adresse_inventee_est_ignoree_et_un_nom_est_retrouve(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', []);
        $this->creerUtilisateur($entreprise, 'Employé', ['prenom' => 'Pierre', 'nom' => 'Test', 'email' => 'pierre@alpha.mg']);

        $invente = $this->formulaires()->construire($admin, 'changer_statut_utilisateur', ['email' => 'pierre.test@entreprise.fr', 'actif' => false]);
        $this->assertArrayNotHasKey('email', $invente['valeurs']);
        $this->assertSame('false', $invente['valeurs']['actif']);

        $nom = $this->formulaires()->construire($admin, 'changer_statut_utilisateur', ['email' => 'Pierre Test']);
        $this->assertSame('pierre@alpha.mg', $nom['valeurs']['email']);
    }

    public function test_la_cible_est_choisie_dans_la_liste_a_partir_du_titre(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $c = Contenu::create([
            'entreprise_id' => $entreprise->id, 'auteur_id' => $admin->id, 'type_contenu' => 'actualite', 'titre' => 'Pas de travail demain',
            'corps' => 'Texte.', 'statut_contenu' => 'publie', 'visibilite' => 'entreprise', 'date_publication' => now(),
        ]);

        $f = $this->formulaires()->construire($admin, 'changer_statut_contenu', ['type' => 'actualite', 'titre_actuel' => 'pas de travail', 'action' => 'archiver']);

        $this->assertSame($c->id, $f['valeurs']['id']);
        $this->assertSame('archiver', $f['valeurs']['action']);
        $this->assertSame('actualite', $this->champ($f, 'id')['options'][0]['type']);
        $this->assertSame(['champ' => 'type'], $this->champ($f, 'id')['si']);
    }

    public function test_un_manager_ne_voit_que_son_departement(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $finance = Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Finance']);
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Technique']);
        $manager = $this->creerUtilisateur($entreprise, 'Manager', ['departement_id' => $finance->id]);

        $champ = $this->champ($this->formulaires()->construire($manager, 'publier_contenu'), 'departement');

        $this->assertSame(['Finance'], array_column($champ['options'], 'valeur'));
        $this->assertTrue($champ['requis']);
        $this->assertArrayNotHasKey('vide', $champ);
    }

    public function test_les_valeurs_d_identite_inventees_par_le_modele_sont_supprimees(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', []);
        $prefill = ['nom' => 'Dupont', 'prenom' => 'Jean', 'email' => 'jean.dupont@entreprise.fr', 'role' => 'Employé'];

        $invente = $this->formulaires()->construire($admin, 'creer_utilisateur', $prefill, 'comment cree un utilisateur dans l intranet');
        $this->assertSame([], $invente['valeurs']);

        $dit = $this->formulaires()->construire($admin, 'creer_utilisateur', ['nom' => 'Rakoto', 'prenom' => 'Jean', 'email' => 'jean@alpha.mg', 'role' => 'RH'], 'Crée un compte pour Jean Rakoto, jean@alpha.mg, RH');
        $this->assertSame('Rakoto', $dit['valeurs']['nom']);
        $this->assertSame('jean@alpha.mg', $dit['valeurs']['email']);
        $this->assertSame('RH', $dit['valeurs']['role']);
        $this->assertSame('Adresse e-mail professionnelle', $this->champ($dit, 'email')['libelle']);
    }

    public function test_un_employe_n_a_aucun_formulaire(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->assertSame([], $this->formulaires()->catalogue($employe));
        $this->expectException(ToolException::class);
        $this->formulaires()->construire($employe, 'publier_contenu');
    }

    public function test_les_cles_inconnues_sont_ignorees_a_la_soumission(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites']);

        $p = $this->formulaires()->parametres($admin, 'publier_contenu', [
            'type' => 'actualite', 'titre' => ' Titre ', 'corps' => 'Texte', 'brouillon' => 'false', 'entreprise_id' => 999, 'departement' => '',
        ]);

        $this->assertSame(['type' => 'actualite', 'titre' => 'Titre', 'corps' => 'Texte', 'brouillon' => false], $p);
    }

    public function test_api_catalogue_formulaire_soumission_puis_confirmation(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites']);

        $this->connecter($admin)->getJson('/api/assistant/formulaires')->assertOk()
            ->assertJsonFragment(['outil' => 'publier_contenu']);
        $this->connecter($admin)->getJson('/api/assistant/formulaires/publier_contenu')->assertOk()
            ->assertJsonPath('outil', 'publier_contenu')->assertJsonPath('valeurs', []);

        $reponse = $this->connecter($admin)->postJson('/api/assistant/formulaires/publier_contenu', [
            'valeurs' => ['type' => 'actualite', 'titre' => 'Via formulaire', 'corps' => 'Texte'],
        ])->assertOk()->assertJsonCount(1, 'actions');
        $this->assertDatabaseMissing('contenus', ['titre' => 'Via formulaire']);

        $this->connecter($admin)->postJson('/api/assistant/actions/'.$reponse->json('actions.0.id').'/confirmer')->assertOk();
        $this->assertDatabaseHas('contenus', ['titre' => 'Via formulaire', 'statut_contenu' => 'publie']);
    }

    public function test_api_valeurs_invalides_et_employe(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $this->connecter($admin)->postJson('/api/assistant/formulaires/publier_contenu', ['valeurs' => ['type' => 'actualite']])
            ->assertUnprocessable()->assertJsonStructure(['message']);
        $this->connecter($employe)->getJson('/api/assistant/formulaires')->assertForbidden();
        $this->connecter($employe)->getJson('/api/assistant/formulaires/publier_contenu')->assertForbidden();
    }

    public function test_en_mode_formulaire_le_modele_ne_cree_pas_d_action(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['actualites']);
        config(['assistant.formulaires' => true]);
        Http::fake(['*/api/chat' => Http::response(['message' => [
            'role' => 'assistant',
            'content' => '',
            'tool_calls' => [['function' => ['name' => 'publier_contenu', 'arguments' => ['type' => 'actualite', 'titre' => 'test', 'corps' => 'finale', 'departement' => 'aucun']]]],
        ]])]);

        $res = app(AgentService::class)->envoyer($admin, null, 'Publie une actualité : test, finale, toute entreprise');

        $this->assertSame([], $res['actions']);
        $this->assertCount(1, $res['formulaires']);
        $this->assertSame('publier_contenu', $res['formulaires'][0]['outil']);
        $this->assertSame('test', $res['formulaires'][0]['valeurs']['titre']);
        $this->assertArrayNotHasKey('departement', $res['formulaires'][0]['valeurs']);
        $this->assertDatabaseCount('assistant_actions', 0);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Entreprise;
use App\Models\Utilisateur;
use App\Services\NotificationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\IntranetTestCase;

class NotificationTest extends IntranetTestCase
{
    private Entreprise $entreprise;

    private Utilisateur $admin;

    private Departement $finance;

    private Departement $technique;

    private Utilisateur $employeFinance;

    private Utilisateur $employeTechnique;

    private Utilisateur $employeSansDepartement;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->entreprise, $this->admin] = $this->creerEntreprise('Acme', ['actualites', 'documents', 'calendrier', 'evenements']);

        $this->finance = Departement::create(['entreprise_id' => $this->entreprise->id, 'nom_departement' => 'Finance']);
        $this->technique = Departement::create(['entreprise_id' => $this->entreprise->id, 'nom_departement' => 'Technique']);

        $this->employeFinance = $this->creerUtilisateur($this->entreprise, 'Employé', ['departement_id' => $this->finance->id]);
        $this->employeTechnique = $this->creerUtilisateur($this->entreprise, 'Employé', ['departement_id' => $this->technique->id]);
        $this->employeSansDepartement = $this->creerUtilisateur($this->entreprise, 'Employé');
    }

    private function publierActualite(string $visibilite, ?Departement $departement = null, string $titre = 'Nouvelle politique'): void
    {
        $actualite = Contenu::create([
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => $this->admin->id,
            'type_contenu' => 'actualite',
            'titre' => $titre,
            'corps' => 'Contenu',
            'statut_contenu' => 'brouillon',
            'visibilite' => $visibilite,
            'departement_id' => $departement?->id,
        ]);

        $this->connecter($this->admin)->postJson("/api/contenus/actualite/{$actualite->id}/publier")->assertOk();
    }

    private function nonLues(Utilisateur $u): int
    {
        return $this->connecter($u)->getJson('/api/notifications/non-lues')->assertOk()->json('non_lues');
    }

    public function test_une_publication_pour_toute_lentreprise_notifie_tout_le_monde_sauf_lauteur(): void
    {
        $this->publierActualite('entreprise');

        $this->assertSame(1, $this->nonLues($this->employeFinance));
        $this->assertSame(1, $this->nonLues($this->employeTechnique));
        $this->assertSame(1, $this->nonLues($this->employeSansDepartement));
        $this->assertSame(0, $this->nonLues($this->admin));
    }

    public function test_une_publication_ciblee_ne_notifie_que_le_departement_concerne(): void
    {
        $this->publierActualite('departement', $this->finance);

        $this->assertSame(1, $this->nonLues($this->employeFinance));
        $this->assertSame(0, $this->nonLues($this->employeTechnique));
        $this->assertSame(0, $this->nonLues($this->employeSansDepartement));

        // Les départements non concernés ne voient rien dans leur liste non plus
        $this->connecter($this->employeTechnique)->getJson('/api/notifications')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_la_notification_indique_qui_a_fait_quoi_et_quand(): void
    {
        $this->publierActualite('departement', $this->finance, 'Clôture trimestrielle');

        $reponse = $this->connecter($this->employeFinance)->getJson('/api/notifications')->assertOk();

        $reponse->assertJsonPath('data.0.action', 'publie')
            ->assertJsonPath('data.0.objet_type', 'actualite')
            ->assertJsonPath('data.0.titre', 'Clôture trimestrielle')
            ->assertJsonPath('data.0.departement', 'Finance')
            ->assertJsonPath('data.0.acteur.id', $this->admin->id)
            ->assertJsonPath('data.0.lu', false);
        $this->assertNotEmpty($reponse->json('data.0.date'));
    }

    public function test_un_compte_desactive_nest_pas_notifie(): void
    {
        $inactif = $this->creerUtilisateur($this->entreprise, 'Employé', [
            'departement_id' => $this->finance->id,
            'statut_compte' => 'inactif',
        ]);

        $this->publierActualite('entreprise');

        $this->assertDatabaseMissing('notification_utilisateurs', ['utilisateur_id' => $inactif->id]);
    }

    public function test_un_module_desactive_ne_diffuse_aucune_notification(): void
    {
        $this->basculerModule($this->entreprise, 'actualites', false);

        // L'API refuse déjà la publication d'un module désactivé ; on déclenche donc le service directement
        app(NotificationService::class)->publier($this->admin, 'publie', 'actualite', 1, 'Titre', null);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_marquer_comme_lue_et_tout_lire(): void
    {
        $this->publierActualite('entreprise', null, 'Première');
        $this->publierActualite('entreprise', null, 'Deuxième');

        $this->assertSame(2, $this->nonLues($this->employeFinance));

        $premiere = $this->getJson('/api/notifications')->json('data.0.id');
        $this->postJson("/api/notifications/{$premiere}/lire")->assertOk();
        $this->assertSame(1, $this->nonLues($this->employeFinance));

        $this->postJson('/api/notifications/tout-lire')->assertOk();
        $this->assertSame(0, $this->nonLues($this->employeFinance));

        $this->getJson('/api/notifications?non_lues=1')->assertOk()->assertJsonCount(0, 'data');
        // Les autres utilisateurs ne sont pas touchés
        $this->assertSame(2, $this->nonLues($this->employeTechnique));
    }

    public function test_on_ne_peut_pas_lire_la_notification_dun_autre(): void
    {
        $this->publierActualite('entreprise');

        $idFinance = $this->connecter($this->employeFinance)->getJson('/api/notifications')->json('data.0.id');

        $this->connecter($this->employeTechnique)
            ->postJson("/api/notifications/{$idFinance}/lire")->assertNotFound();
    }

    public function test_un_evenement_cible_ne_notifie_que_son_departement(): void
    {
        $this->connecter($this->admin)->postJson('/api/evenements', [
            'titre_evenement' => 'Réunion budget',
            'date_debut' => '2026-11-10 09:00:00',
            'date_fin' => '2026-11-10 11:00:00',
            'visibilite' => 'departement',
            'departement_id' => $this->finance->id,
        ])->assertCreated();

        $this->assertSame(1, $this->nonLues($this->employeFinance));
        $this->assertSame(0, $this->nonLues($this->employeTechnique));

        $this->connecter($this->employeFinance)->getJson('/api/notifications')
            ->assertJsonPath('data.0.action', 'cree')
            ->assertJsonPath('data.0.objet_type', 'evenement')
            ->assertJsonPath('data.0.titre', 'Réunion budget');
    }

    public function test_un_document_depose_notifie_toute_lentreprise(): void
    {
        Storage::fake('local');

        $this->connecter($this->admin)->postJson('/api/documents', [
            'fichier' => UploadedFile::fake()->create('reglement.pdf', 20, 'application/pdf'),
            'categorie' => 'RH',
            'visibilite' => 'entreprise',
        ])->assertCreated();

        $this->assertSame(1, $this->nonLues($this->employeFinance));
        $this->assertSame(1, $this->nonLues($this->employeTechnique));

        $this->connecter($this->employeTechnique)->getJson('/api/notifications')
            ->assertJsonPath('data.0.action', 'depose')
            ->assertJsonPath('data.0.objet_type', 'document');
    }

    public function test_archiver_un_contenu_retire_ses_notifications(): void
    {
        $this->publierActualite('entreprise');
        $this->assertSame(1, $this->nonLues($this->employeFinance));

        $id = Contenu::where('type_contenu', 'actualite')->value('id');
        $this->connecter($this->admin)->postJson("/api/contenus/actualite/{$id}/archiver")->assertOk();

        $this->assertSame(0, $this->nonLues($this->employeFinance));
        $this->assertDatabaseCount('notifications', 0);
    }
}

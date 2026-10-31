<?php

namespace Tests\Feature;

use App\Models\Departement;
use App\Models\Document;
use App\Models\Entreprise;
use App\Models\Utilisateur;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\IntranetTestCase;

/**
 * RG05 : une entreprise ne voit ni ne modifie jamais les données d'une autre.
 * Chaque test connecte l'administrateur de A et vise une ressource de B.
 */
class IsolationEntreprisesTest extends IntranetTestCase
{
    private Entreprise $a;

    private Utilisateur $adminA;

    private Entreprise $b;

    private Utilisateur $employeB;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('fichiers');

        [$this->a, $this->adminA] = $this->creerEntreprise('Alpha', ['annuaire', 'documents']);
        [$this->b] = $this->creerEntreprise('Beta', ['annuaire', 'documents']);
        $this->employeB = $this->creerUtilisateur($this->b, 'Employé', ['nom' => 'Etranger', 'prenom' => 'Eve']);
    }

    private function documentDeB(string $visibilite = 'entreprise'): Document
    {
        return Document::create([
            'entreprise_id' => $this->b->id,
            'auteur_id' => $this->employeB->id,
            'nom_document' => 'Secret de Beta',
            'fichier' => 'documents/'.$this->b->id.'/secret.pdf',
            'type_mime' => 'application/pdf',
            'taille_fichier' => 1,
            'categorie' => 'Interne',
            'visibilite' => $visibilite,
        ]);
    }

    public function test_la_liste_des_utilisateurs_ne_contient_que_son_entreprise(): void
    {
        $reponse = $this->connecter($this->adminA)->getJson('/api/utilisateurs')->assertOk();

        $emails = collect($reponse->json('data'))->pluck('email');
        $this->assertContains($this->adminA->email, $emails);
        $this->assertNotContains($this->employeB->email, $emails);
    }

    public function test_un_utilisateur_d_une_autre_entreprise_est_introuvable(): void
    {
        $this->connecter($this->adminA);
        $id = $this->employeB->id;

        $this->getJson("/api/utilisateurs/{$id}")->assertNotFound();
        $this->putJson("/api/utilisateurs/{$id}", ['poste' => 'Piraté'])->assertNotFound();
        $this->putJson("/api/utilisateurs/{$id}/statut", ['actif' => false])->assertNotFound();

        $this->assertSame('actif', $this->employeB->fresh()->statut_compte);
        $this->assertNull($this->employeB->fresh()->poste);
    }

    public function test_on_ne_peut_pas_creer_un_compte_avec_un_role_ou_un_departement_d_une_autre_entreprise(): void
    {
        $departementB = Departement::create(['entreprise_id' => $this->b->id, 'nom_departement' => 'Compta B']);

        $this->connecter($this->adminA)->postJson('/api/utilisateurs', [
            'nom' => 'Pirate', 'prenom' => 'Paul', 'email' => 'pirate@exemple.test',
            'mot_de_passe' => 'MotDePasse123!',
            'role_id' => $this->role($this->b, 'Employé')->id,
        ])->assertStatus(422)->assertJsonValidationErrors('role_id');

        $this->postJson('/api/utilisateurs', [
            'nom' => 'Pirate', 'prenom' => 'Paul', 'email' => 'pirate@exemple.test',
            'mot_de_passe' => 'MotDePasse123!',
            'role_id' => $this->role($this->a, 'Employé')->id,
            'departement_id' => $departementB->id,
        ])->assertStatus(422)->assertJsonValidationErrors('departement_id');

        $this->assertDatabaseMissing('utilisateurs', ['email' => 'pirate@exemple.test']);
    }

    public function test_l_annuaire_et_l_organigramme_ignorent_l_autre_entreprise(): void
    {
        $this->connecter($this->adminA);

        $liste = $this->getJson('/api/annuaire?q=Etranger')->assertOk();
        $this->assertSame(0, $liste->json('total'));

        $personnes = $this->getJson('/api/organigramme/personnes')->assertOk();
        $this->assertNotContains($this->employeB->id, collect($personnes->json())->pluck('id')->all());

        $this->getJson('/api/annuaire/'.$this->employeB->id)->assertNotFound();
    }

    public function test_les_documents_d_une_autre_entreprise_sont_invisibles_et_intouchables(): void
    {
        $document = $this->documentDeB();
        Storage::disk('fichiers')->put($document->fichier, 'contenu secret');
        $this->connecter($this->adminA);

        $liste = $this->getJson('/api/documents')->assertOk();
        $this->assertSame(0, $liste->json('total'));

        $this->getJson("/api/documents/{$document->id}")->assertNotFound();
        $this->getJson("/api/documents/{$document->id}/lien")->assertNotFound();
        $this->putJson("/api/documents/{$document->id}", ['categorie' => 'Piraté'])->assertNotFound();
        $this->deleteJson("/api/documents/{$document->id}")->assertNotFound();

        $this->assertDatabaseHas('documents', ['id' => $document->id, 'categorie' => 'Interne']);
        Storage::disk('fichiers')->assertExists($document->fichier);
    }

    public function test_un_document_ne_peut_pas_viser_le_departement_d_une_autre_entreprise(): void
    {
        $departementB = Departement::create(['entreprise_id' => $this->b->id, 'nom_departement' => 'Compta B']);

        $this->connecter($this->adminA)->postJson('/api/documents', [
            'fichier' => UploadedFile::fake()->create('note.pdf', 10, 'application/pdf'),
            'categorie' => 'Interne',
            'visibilite' => 'departement',
            'departement_id' => $departementB->id,
        ])->assertStatus(422)->assertJsonValidationErrors('departement_id');

        $this->assertDatabaseCount('documents', 0);
    }

    public function test_les_departements_et_les_roles_d_une_autre_entreprise_sont_introuvables(): void
    {
        $departementB = Departement::create(['entreprise_id' => $this->b->id, 'nom_departement' => 'Compta B']);
        $this->connecter($this->adminA);

        $this->getJson("/api/departements/{$departementB->id}")->assertNotFound();
        $this->deleteJson("/api/departements/{$departementB->id}")->assertNotFound();
        $this->getJson('/api/roles/'.$this->role($this->b, 'Employé')->id)->assertNotFound();

        $this->assertDatabaseHas('departements', ['id' => $departementB->id]);
    }

    public function test_le_menu_et_les_modules_dependent_de_l_entreprise_de_l_appelant(): void
    {
        $this->basculerModule($this->b, 'documents', false);

        $codesA = collect($this->connecter($this->adminA)->getJson('/api/menu')->json('modules'))->pluck('code');
        $this->assertContains('documents', $codesA);

        // La désactivation chez B ne touche pas A
        $this->getJson('/api/documents')->assertOk();
    }
}

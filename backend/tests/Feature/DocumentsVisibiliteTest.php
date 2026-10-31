<?php

namespace Tests\Feature;

use App\Models\Departement;
use App\Models\Document;
use App\Models\Entreprise;
use App\Models\Utilisateur;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\IntranetTestCase;

class DocumentsVisibiliteTest extends IntranetTestCase
{
    private Entreprise $entreprise;

    private Utilisateur $admin;

    private Departement $compta;

    private Departement $it;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('fichiers');

        [$this->entreprise, $this->admin] = $this->creerEntreprise('Alpha', ['documents']);
        $this->compta = Departement::create(['entreprise_id' => $this->entreprise->id, 'nom_departement' => 'Comptabilité']);
        $this->it = Departement::create(['entreprise_id' => $this->entreprise->id, 'nom_departement' => 'Informatique']);
    }

    private function document(string $nom, string $visibilite = 'entreprise', ?Departement $departement = null, ?Utilisateur $auteur = null): Document
    {
        $chemin = 'documents/'.$this->entreprise->id.'/'.md5($nom).'.pdf';
        Storage::disk('fichiers')->put($chemin, "contenu de {$nom}");

        return Document::create([
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => ($auteur ?? $this->admin)->id,
            'departement_id' => $departement?->id,
            'nom_document' => $nom,
            'fichier' => $chemin,
            'type_mime' => 'application/pdf',
            'taille_fichier' => 1,
            'categorie' => 'Interne',
            'visibilite' => $visibilite,
        ]);
    }

    private function noms($reponse): array
    {
        return collect($reponse->json('data'))->pluck('nom_document')->sort()->values()->all();
    }

    public function test_un_employe_voit_les_documents_de_l_entreprise_et_de_son_departement_seulement(): void
    {
        $this->document('Règlement');
        $this->document('Budget compta', 'departement', $this->compta);
        $this->document('Schéma réseau', 'departement', $this->it);

        $employe = $this->creerUtilisateur($this->entreprise, 'Employé', ['departement_id' => $this->compta->id]);

        $reponse = $this->connecter($employe)->getJson('/api/documents')->assertOk();

        $this->assertSame(['Budget compta', 'Règlement'], $this->noms($reponse));
    }

    public function test_un_employe_sans_departement_ne_voit_que_les_documents_de_l_entreprise(): void
    {
        $this->document('Règlement');
        $this->document('Budget compta', 'departement', $this->compta);

        $employe = $this->creerUtilisateur($this->entreprise, 'Employé', ['departement_id' => null]);

        $this->assertSame(['Règlement'], $this->noms($this->connecter($employe)->getJson('/api/documents')->assertOk()));
    }

    public function test_l_auteur_voit_toujours_son_document_meme_d_un_autre_departement(): void
    {
        $manager = $this->creerUtilisateur($this->entreprise, 'Manager', ['departement_id' => $this->compta->id]);
        $this->document('Mon dépôt IT', 'departement', $this->it, $manager);
        $this->document('Autre dépôt IT', 'departement', $this->it);

        $this->assertSame(['Mon dépôt IT'], $this->noms($this->connecter($manager)->getJson('/api/documents')->assertOk()));
    }

    public function test_un_document_d_un_autre_departement_est_introuvable_et_sans_lien(): void
    {
        $document = $this->document('Schéma réseau', 'departement', $this->it);
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé', ['departement_id' => $this->compta->id]);

        $this->connecter($employe);
        $this->getJson("/api/documents/{$document->id}")->assertNotFound();
        $this->getJson("/api/documents/{$document->id}/lien")->assertNotFound();
    }

    public function test_les_categories_ne_revelent_que_celles_des_documents_visibles(): void
    {
        $secret = $this->document('Schéma réseau', 'departement', $this->it);
        $secret->update(['categorie' => 'Confidentiel']);
        $this->document('Règlement');

        $employe = $this->creerUtilisateur($this->entreprise, 'Employé', ['departement_id' => $this->compta->id]);

        $this->assertSame(['Interne'], $this->connecter($employe)->getJson('/api/documents/categories')->assertOk()->json());
    }

    public function test_la_recherche_par_nom_est_insensible_a_la_casse_et_traite_les_jokers_litteralement(): void
    {
        // ASCII seulement : la casse des lettres accentuées dépend de la locale de PostgreSQL
        $this->document('Regles internes');
        $this->document('Budget 100% annuel');
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé');
        $this->connecter($employe);

        $this->assertSame(['Regles internes'], $this->noms($this->getJson('/api/documents?q=REGLES')));
        $this->assertSame(['Budget 100% annuel'], $this->noms($this->getJson('/api/documents?q='.urlencode('100%'))));
        $this->assertSame([], $this->noms($this->getJson('/api/documents?q='.urlencode('%'.'zzz'))));
    }

    public function test_le_lien_signe_telecharge_le_fichier(): void
    {
        $document = $this->document('Règlement');
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé');

        $url = $this->connecter($employe)->getJson("/api/documents/{$document->id}/lien")
            ->assertOk()->json('url');

        $this->assertStringContainsString('signature=', $url);

        $fichier = $this->get($url)->assertOk();
        $this->assertSame('contenu de Règlement', $fichier->streamedContent());
        $fichier->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_le_fichier_est_inaccessible_sans_signature_ou_avec_une_signature_alteree(): void
    {
        $document = $this->document('Règlement');
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé');

        $url = $this->connecter($employe)->getJson("/api/documents/{$document->id}/lien")->json('url');

        $this->get("/api/documents/{$document->id}/fichier")->assertForbidden();
        $this->get($url.'0')->assertForbidden();

        // Une signature valable pour un document ne vaut pas pour un autre
        $autre = $this->document('Autre');
        $this->get(str_replace("/documents/{$document->id}/", "/documents/{$autre->id}/", $url))->assertForbidden();
    }

    public function test_le_lien_expire_apres_cinq_minutes(): void
    {
        $document = $this->document('Règlement');
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé');

        $url = $this->connecter($employe)->getJson("/api/documents/{$document->id}/lien")->json('url');

        $this->travel(6)->minutes();

        $this->get($url)->assertForbidden();
    }

    public function test_l_ancienne_route_telecharger_n_existe_plus(): void
    {
        $document = $this->document('Règlement');
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé');

        $this->connecter($employe)->getJson("/api/documents/{$document->id}/telecharger")->assertNotFound();
    }

    public function test_un_manager_depose_un_document_rattache_a_son_entreprise(): void
    {
        $manager = $this->creerUtilisateur($this->entreprise, 'Manager');

        $reponse = $this->connecter($manager)->post('/api/documents', [
            'fichier' => UploadedFile::fake()->create('note.pdf', 50, 'application/pdf'),
            'categorie' => 'RH',
            'visibilite' => 'departement',
            'departement_id' => $this->compta->id,
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertDatabaseHas('documents', [
            'id' => $reponse->json('id'),
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => $manager->id,
            'departement_id' => $this->compta->id,
            'nom_document' => 'note',
        ]);
        Storage::disk('fichiers')->assertExists(Document::find($reponse->json('id'))->fichier);
    }

    public function test_un_employe_ne_peut_pas_deposer_un_document(): void
    {
        $employe = $this->creerUtilisateur($this->entreprise, 'Employé');

        $this->connecter($employe)->post('/api/documents', [
            'fichier' => UploadedFile::fake()->create('note.pdf', 50, 'application/pdf'),
            'categorie' => 'RH',
            'visibilite' => 'entreprise',
        ], ['Accept' => 'application/json'])->assertForbidden();

        $this->assertDatabaseCount('documents', 0);
    }

    public function test_les_types_de_fichier_dangereux_sont_refuses(): void
    {
        $manager = $this->creerUtilisateur($this->entreprise, 'Manager');

        $this->connecter($manager)->post('/api/documents', [
            'fichier' => UploadedFile::fake()->create('script.php', 5, 'application/x-php'),
            'categorie' => 'RH',
            'visibilite' => 'entreprise',
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('fichier');

        $this->assertDatabaseCount('documents', 0);
    }

    public function test_supprimer_un_document_efface_aussi_le_fichier(): void
    {
        $document = $this->document('Règlement');
        $manager = $this->creerUtilisateur($this->entreprise, 'Manager');

        $this->connecter($manager)->deleteJson("/api/documents/{$document->id}")->assertOk();

        $this->assertDatabaseMissing('documents', ['id' => $document->id]);
        Storage::disk('fichiers')->assertMissing($document->fichier);
    }

    public function test_la_modification_exige_un_departement_pour_la_visibilite_departement(): void
    {
        $document = $this->document('Règlement');
        $manager = $this->creerUtilisateur($this->entreprise, 'Manager');
        $this->connecter($manager);

        $this->putJson("/api/documents/{$document->id}", ['visibilite' => 'departement'])->assertStatus(422);
        $this->putJson("/api/documents/{$document->id}", [])->assertStatus(422);

        $this->putJson("/api/documents/{$document->id}", ['visibilite' => 'departement', 'departement_id' => $this->it->id])
            ->assertOk()->assertJsonPath('departement_id', $this->it->id);
    }
}

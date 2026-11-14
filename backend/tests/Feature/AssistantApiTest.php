<?php

namespace Tests\Feature;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\IntranetTestCase;

class AssistantApiTest extends IntranetTestCase
{
    private function appelCreation(): array
    {
        return ['message' => [
            'role' => 'assistant',
            'content' => '',
            'tool_calls' => [['function' => [
                'name' => 'creer_utilisateur',
                'arguments' => ['nom' => 'Rakoto', 'prenom' => 'Jean', 'email' => 'rakoto@exemple.mg', 'role' => 'RH'],
            ]]],
        ]];
    }

    public function test_sans_jeton_l_acces_est_refuse(): void
    {
        $this->postJson('/api/assistant/messages', ['message' => 'Bonjour'])->assertUnauthorized();
    }

    public function test_un_employe_n_a_pas_acces_a_l_assistant(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        Http::fake();

        $this->connecter($employe)->postJson('/api/assistant/messages', ['message' => 'Crée un utilisateur'])
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_le_message_est_obligatoire_et_limite(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake();

        $this->connecter($admin)->postJson('/api/assistant/messages', [])->assertUnprocessable();
        $this->connecter($admin)->postJson('/api/assistant/messages', ['message' => str_repeat('a', 2001)])
            ->assertUnprocessable();
    }

    public function test_parcours_complet_message_puis_confirmation(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->appelCreation())]);

        $reponse = $this->connecter($admin)
            ->postJson('/api/assistant/messages', ['message' => 'Crée Jean Rakoto, RH'])
            ->assertOk()
            ->assertJsonCount(1, 'actions');
        $this->assertDatabaseMissing('utilisateurs', ['email' => 'rakoto@exemple.mg']);

        $actionId = $reponse->json('actions.0.id');
        $confirmation = $this->postJson("/api/assistant/actions/{$actionId}/confirmer")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure(['secret' => ['mot_de_passe_temporaire']]);

        $this->assertStringContainsString('no-store', $confirmation->headers->get('Cache-Control'));
        $this->assertDatabaseHas('utilisateurs', ['email' => 'rakoto@exemple.mg']);

        $this->postJson("/api/assistant/actions/{$actionId}/confirmer")->assertStatus(409);
    }

    public function test_l_annulation_empeche_la_creation(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->appelCreation())]);

        $actionId = $this->connecter($admin)
            ->postJson('/api/assistant/messages', ['message' => 'Crée Jean Rakoto, RH'])
            ->json('actions.0.id');

        $this->postJson("/api/assistant/actions/{$actionId}/annuler")->assertOk();
        $this->postJson("/api/assistant/actions/{$actionId}/confirmer")->assertStatus(409);
        $this->assertDatabaseMissing('utilisateurs', ['email' => 'rakoto@exemple.mg']);
    }

    public function test_un_autre_administrateur_ne_peut_pas_confirmer(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha');
        [, $adminB] = $this->creerEntreprise('Beta');
        Http::fake(['*/api/chat' => Http::response($this->appelCreation())]);

        $actionId = $this->connecter($adminA)
            ->postJson('/api/assistant/messages', ['message' => 'Crée Jean Rakoto, RH'])
            ->json('actions.0.id');

        $this->connecter($adminB)->postJson("/api/assistant/actions/{$actionId}/confirmer")->assertNotFound();
        $this->assertDatabaseMissing('utilisateurs', ['email' => 'rakoto@exemple.mg']);
    }

    public function test_ollama_injoignable_donne_une_erreur_503(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(fn () => throw new ConnectionException('refusé'));

        $this->connecter($admin)->postJson('/api/assistant/messages', ['message' => 'Bonjour'])
            ->assertStatus(503)
            ->assertJsonStructure(['message']);
    }
}

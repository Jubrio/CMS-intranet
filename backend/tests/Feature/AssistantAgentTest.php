<?php

namespace Tests\Feature;

use App\Assistant\AgentService;
use App\Assistant\AssistantIndisponible;
use App\Assistant\Tools\ToolException;
use App\Models\AssistantAction;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\IntranetTestCase;

class AssistantAgentTest extends IntranetTestCase
{
    private function appelOutil(array $arguments, string $nom = 'creer_utilisateur'): array
    {
        return ['message' => [
            'role' => 'assistant',
            'content' => '',
            'tool_calls' => [['function' => ['name' => $nom, 'arguments' => $arguments]]],
        ]];
    }

    private function texte(string $contenu): array
    {
        return ['message' => ['role' => 'assistant', 'content' => $contenu]];
    }

    private function service(): AgentService
    {
        return app(AgentService::class);
    }

    private function argumentsValides(): array
    {
        return ['nom' => 'Rakoto', 'prenom' => 'Jean', 'email' => 'rakoto@exemple.mg', 'role' => 'RH'];
    }

    public function test_une_reponse_texte_est_renvoyee_sans_action(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->texte('Bonjour, comment puis-je aider ?'))]);

        $res = $this->service()->envoyer($admin, null, 'Bonjour');

        $this->assertSame('Bonjour, comment puis-je aider ?', $res['reponse']);
        $this->assertSame([], $res['actions']);
        $this->assertDatabaseCount('assistant_actions', 0);
    }

    public function test_une_demande_de_creation_cree_une_action_en_attente_sans_rien_executer(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->appelOutil($this->argumentsValides()))]);

        $res = $this->service()->envoyer($admin, null, 'Crée Jean Rakoto, RH');

        $this->assertCount(1, $res['actions']);
        $this->assertDatabaseHas('assistant_actions', ['outil' => 'creer_utilisateur', 'statut' => 'en_attente']);
        $this->assertDatabaseMissing('utilisateurs', ['email' => 'rakoto@exemple.mg']);
    }

    public function test_la_confirmation_cree_le_compte_et_ne_stocke_pas_le_mot_de_passe(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->appelOutil($this->argumentsValides()))]);
        $actionId = $this->service()->envoyer($admin, null, 'Crée Jean Rakoto, RH')['actions'][0]['id'];

        $res = $this->service()->confirmer($admin, $actionId);

        $this->assertTrue($res['ok']);
        $this->assertNotEmpty($res['secret']['mot_de_passe_temporaire']);
        $this->assertDatabaseHas('utilisateurs', ['email' => 'rakoto@exemple.mg']);

        $action = AssistantAction::findOrFail($actionId);
        $this->assertSame('executee', $action->statut);
        $this->assertStringNotContainsString($res['secret']['mot_de_passe_temporaire'], json_encode($action->toArray()));
        $this->assertDatabaseMissing('assistant_messages', ['contenu' => $res['secret']['mot_de_passe_temporaire']]);
    }

    public function test_une_action_ne_peut_etre_confirmee_qu_une_fois(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->appelOutil($this->argumentsValides()))]);
        $actionId = $this->service()->envoyer($admin, null, 'Crée Jean Rakoto, RH')['actions'][0]['id'];

        $this->service()->confirmer($admin, $actionId);

        $this->expectException(ToolException::class);
        $this->service()->confirmer($admin, $actionId);
    }

    public function test_une_action_annulee_n_est_jamais_executee(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->appelOutil($this->argumentsValides()))]);
        $actionId = $this->service()->envoyer($admin, null, 'Crée Jean Rakoto, RH')['actions'][0]['id'];

        $this->service()->annuler($admin, $actionId);

        $this->assertDatabaseHas('assistant_actions', ['id' => $actionId, 'statut' => 'annulee']);
        $this->assertDatabaseMissing('utilisateurs', ['email' => 'rakoto@exemple.mg']);
        $this->expectException(ToolException::class);
        $this->service()->confirmer($admin, $actionId);
    }

    public function test_un_autre_utilisateur_ne_peut_pas_confirmer_l_action_d_un_autre(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha');
        [, $adminB] = $this->creerEntreprise('Beta');
        Http::fake(['*/api/chat' => Http::response($this->appelOutil($this->argumentsValides()))]);
        $actionId = $this->service()->envoyer($adminA, null, 'Crée Jean Rakoto, RH')['actions'][0]['id'];

        $this->expectException(ModelNotFoundException::class);
        $this->service()->confirmer($adminB, $actionId);
    }

    public function test_un_parametre_invalide_est_renvoye_au_modele_qui_peut_repondre(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::sequence()
            ->push($this->appelOutil(['nom' => 'Rakoto', 'prenom' => 'Jean', 'email' => 'rakoto@exemple.mg', 'role' => 'Directeur']))
            ->push($this->texte('Ce rôle n\'existe pas. Choisissez Employé, Manager, RH ou Administrateur.')),
        ]);

        $res = $this->service()->envoyer($admin, null, 'Crée Jean Rakoto, Directeur');

        $this->assertStringContainsString('Choisissez', $res['reponse']);
        $this->assertSame([], $res['actions']);
        $this->assertDatabaseCount('assistant_actions', 0);
        Http::assertSentCount(2);
    }

    public function test_un_employe_ne_recoit_aucun_outil(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        Http::fake(['*/api/chat' => Http::response($this->texte('Je ne peux rien faire ici.'))]);

        $this->service()->envoyer($employe, null, 'Crée un utilisateur');

        Http::assertSent(fn ($requete) => ! isset($requete->data()['tools']));
    }

    public function test_une_conversation_d_un_autre_utilisateur_est_introuvable(): void
    {
        [, $adminA] = $this->creerEntreprise('Alpha');
        [, $adminB] = $this->creerEntreprise('Beta');
        Http::fake(['*/api/chat' => Http::response($this->texte('Bonjour'))]);
        $id = $this->service()->envoyer($adminA, null, 'Bonjour')['conversation_id'];

        $this->expectException(ModelNotFoundException::class);
        $this->service()->envoyer($adminB, $id, 'Je lis la conversation de A');
    }

    public function test_ollama_injoignable_leve_une_erreur_claire(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(fn () => throw new ConnectionException('refusé'));

        $this->expectException(AssistantIndisponible::class);
        $this->service()->envoyer($admin, null, 'Bonjour');
    }
}

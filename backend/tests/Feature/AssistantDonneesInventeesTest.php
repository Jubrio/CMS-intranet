<?php

namespace Tests\Feature;

use App\Assistant\AgentService;
use App\Models\Departement;
use Illuminate\Support\Facades\Http;
use Tests\IntranetTestCase;

class AssistantDonneesInventeesTest extends IntranetTestCase
{
    private function texte(string $contenu): array
    {
        return ['message' => ['role' => 'assistant', 'content' => $contenu]];
    }

    private function appel(string $nom, array $arguments): array
    {
        return ['message' => ['role' => 'assistant', 'content' => '', 'tool_calls' => [['function' => ['name' => $nom, 'arguments' => $arguments]]]]];
    }

    public function test_une_question_sur_des_donnees_sans_outil_est_relancee_puis_repond_avec_les_vraies_donnees(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        Departement::create(['entreprise_id' => $entreprise->id, 'nom_departement' => 'Support']);
        Http::fake(['*/api/chat' => Http::sequence()
            ->push($this->texte("- Anne Lefèvre — rôle : Manager\n- Bruno Gauthier — rôle : Employé"))
            ->push($this->appel('lister_utilisateurs', ['departement' => 'Support']))
            ->push($this->texte('Personne dans ce département.'))]);

        $res = app(AgentService::class)->envoyer($admin, null, 'Qui sont dans le departement Support');

        $this->assertSame('Personne dans ce département.', $res['reponse']);
        $this->assertStringNotContainsString('Lefèvre', $res['reponse']);
        $this->assertDatabaseHas('assistant_actions', ['outil' => 'lister_utilisateurs', 'statut' => 'executee']);
        Http::assertSentCount(3);
    }

    public function test_si_le_modele_persiste_a_inventer_sa_reponse_n_est_jamais_affichee(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->texte("- Anne Lefèvre — rôle : Manager\n- Bruno Gauthier — rôle : Employé"))]);

        $res = app(AgentService::class)->envoyer($admin, null, 'Qui sont dans le departement Informatique');

        $this->assertStringNotContainsString('Lefèvre', $res['reponse']);
        $this->assertStringContainsString('pas pu consulter', $res['reponse']);
        $this->assertSame([], $res['actions']);
    }

    public function test_une_question_generale_n_est_pas_bloquee(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->texte('Je peux gérer les comptes et les contenus.'))]);

        $res = app(AgentService::class)->envoyer($admin, null, 'Que peux-tu faire pour moi ?');

        $this->assertSame('Je peux gérer les comptes et les contenus.', $res['reponse']);
        Http::assertSentCount(1);
    }

    public function test_les_blocs_de_code_sont_retires_de_la_reponse(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response($this->texte("Voici :\n\n```plaintext\n- a\n- b\n```\n\nFin."))]);

        $res = app(AgentService::class)->envoyer($admin, null, 'Bonjour');

        $this->assertStringNotContainsString('```', $res['reponse']);
        $this->assertStringNotContainsString('plaintext', $res['reponse']);
        $this->assertStringContainsString('- a', $res['reponse']);
    }
}

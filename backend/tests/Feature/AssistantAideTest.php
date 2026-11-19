<?php

namespace Tests\Feature;

use App\Assistant\AgentService;
use App\Assistant\AideIntranet;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\IntranetTestCase;

class AssistantAideTest extends IntranetTestCase
{
    private function aide(): AideIntranet
    {
        return app(AideIntranet::class);
    }

    public function test_les_questions_d_explication_sont_reconnues_et_pas_les_ordres_ni_les_donnees(): void
    {
        foreach ([
            "Comment fonctionne l'intranet ?", "C'est quoi une note de service ?", 'Que peux-tu faire ?', 'Quels sont les rôles ?',
            'Comment publier une actualité', 'A quoi sert le module documents', 'Comment créer un utilisateur ?',
            "comment cree un utilisateur dans l'intranet", 'Comment ajouter un document',
        ] as $question) {
            $this->assertTrue($this->aide()->estQuestionDAide($question), $question);
        }

        foreach ([
            'Qui sont dans le département Support', 'Crée un compte pour Jean Rakoto, RH', 'Liste tous les utilisateurs',
            'Désactive le compte de Pierre Test', 'Publie une actualité : test', 'Bonjour', "Comment s'appelle le manager du support ?",
        ] as $question) {
            $this->assertFalse($this->aide()->estQuestionDAide($question), $question);
        }
    }

    public function test_le_contexte_choisit_les_sujets_et_decrit_le_role(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['faq']);

        $contexte = $this->aide()->contexte($admin, "C'est quoi une note de service ?");

        $this->assertStringContainsString('MODE AIDE', $contexte);
        $this->assertStringContainsString('Notes de service', $contexte);
        $this->assertStringContainsString('FAQ', $contexte); // module activé de cette entreprise
        $this->assertStringContainsString('les utilisateurs', $contexte); // ce que peut gérer un administrateur
        $this->assertNull($this->aide()->contexte($admin, 'Liste tous les utilisateurs'));
    }

    public function test_le_contexte_depend_du_role(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['actualites']);
        $manager = $this->creerUtilisateur($entreprise, 'Manager');

        $contexte = $this->aide()->contexte($manager, 'Que peux-tu faire ?');

        $this->assertStringContainsString('« Manager »', $contexte);
        $this->assertStringNotContainsString('les rôles et permissions', $contexte);
    }

    public function test_une_question_generale_sans_mot_cle_donne_la_presentation(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $contexte = $this->aide()->contexte($admin, 'Explique-moi tout');

        $this->assertStringContainsString("Présentation de l'intranet", $contexte);
        $this->assertStringContainsString('Rôles et permissions', $contexte);
    }

    public function test_en_mode_aide_le_modele_recoit_l_aide_sans_outil_et_la_reponse_n_est_pas_bloquee(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['documents']);
        Http::fake(['*/api/chat' => Http::response(['message' => ['role' => 'assistant', 'content' => 'Le module Documents partage des fichiers.']])]);

        $res = app(AgentService::class)->envoyer($admin, null, 'Comment fonctionne le module documents ?');

        $this->assertSame('Le module Documents partage des fichiers.', $res['reponse']);
        Http::assertSentCount(1);
        Http::assertSent(function (Request $requete) {
            $corps = $requete->data();

            return ! isset($corps['tools'])
                && str_contains($corps['messages'][0]['content'], 'MODE AIDE')
                && str_contains($corps['messages'][0]['content'], 'Documents');
        });
    }

    public function test_hors_mode_aide_les_outils_sont_envoyes(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        Http::fake(['*/api/chat' => Http::response(['message' => ['role' => 'assistant', 'content' => 'Bonjour !']])]);

        app(AgentService::class)->envoyer($admin, null, 'Bonjour');

        Http::assertSent(fn (Request $requete) => isset($requete->data()['tools']) && ! str_contains($requete->data()['messages'][0]['content'], 'MODE AIDE'));
    }
}

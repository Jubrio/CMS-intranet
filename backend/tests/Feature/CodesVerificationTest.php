<?php

namespace Tests\Feature;

use App\Mail\CodeVerificationMail;
use App\Models\CodeVerification;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Mail;
use Tests\IntranetTestCase;

class CodesVerificationTest extends IntranetTestCase
{
    // Envoie un code et le récupère dans le courrier intercepté
    private function codeEnvoye(string $url, array $corps): string
    {
        Mail::fake();
        $this->postJson($url, $corps)->assertOk();

        $code = null;
        Mail::assertSent(CodeVerificationMail::class, function ($m) use (&$code) {
            $code = $m->code;

            return true;
        });

        return $code;
    }

    private function creation(string $email, ?string $jeton): array
    {
        return [
            'nom_entreprise' => 'Nouvelle SA', 'nom' => 'Rakoto', 'prenom' => 'Jean',
            'email' => $email, 'mot_de_passe' => 'MotDePasse123!',
            'jeton_verification' => $jeton ?? 'faux',
        ];
    }

    public function test_le_code_d_inscription_a_six_chiffres_donne_un_jeton_qui_permet_la_creation(): void
    {
        $code = $this->codeEnvoye('/api/intranets/verification/envoyer', ['email' => 'neuf@societe.test']);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);

        $jeton = $this->postJson('/api/intranets/verification/confirmer', ['email' => 'neuf@societe.test', 'code' => $code])
            ->assertOk()->json('jeton_verification');

        $this->postJson('/api/intranets', $this->creation('neuf@societe.test', $jeton))->assertCreated();

        // Le jeton est à usage unique
        $this->postJson('/api/intranets', $this->creation('neuf@societe.test', $jeton))->assertStatus(422);
    }

    public function test_la_creation_sans_adresse_verifiee_est_refusee(): void
    {
        $this->postJson('/api/intranets', $this->creation('pirate@societe.test', null))
            ->assertStatus(422)->assertJsonValidationErrors('jeton_verification');

        // Un jeton obtenu pour une autre adresse ne sert à rien
        $jeton = $this->jetonVerifie('autre@societe.test');
        $this->postJson('/api/intranets', $this->creation('pirate@societe.test', $jeton))
            ->assertStatus(422)->assertJsonValidationErrors('jeton_verification');
    }

    public function test_un_mauvais_code_est_refuse_et_les_essais_sont_limites(): void
    {
        $code = $this->codeEnvoye('/api/intranets/verification/envoyer', ['email' => 'neuf@societe.test']);
        $faux = $code === '000000' ? '111111' : '000000';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/intranets/verification/confirmer', ['email' => 'neuf@societe.test', 'code' => $faux])
                ->assertStatus(422);
        }
        // Après 5 essais, même le bon code est refusé
        $this->postJson('/api/intranets/verification/confirmer', ['email' => 'neuf@societe.test', 'code' => $code])
            ->assertStatus(422);
    }

    public function test_un_code_expire_est_refuse(): void
    {
        $code = $this->codeEnvoye('/api/intranets/verification/envoyer', ['email' => 'neuf@societe.test']);
        CodeVerification::query()->update(['expire_le' => now()->subMinute()]);

        $this->postJson('/api/intranets/verification/confirmer', ['email' => 'neuf@societe.test', 'code' => $code])
            ->assertStatus(422);
    }

    public function test_un_nouvel_envoi_est_limite_a_un_par_minute(): void
    {
        Mail::fake();
        $this->postJson('/api/intranets/verification/envoyer', ['email' => 'neuf@societe.test'])->assertOk();
        $this->postJson('/api/intranets/verification/envoyer', ['email' => 'neuf@societe.test'])->assertOk();

        Mail::assertSent(CodeVerificationMail::class, 1);
    }

    public function test_une_adresse_deja_utilisee_ne_recoit_rien_mais_la_reponse_est_la_meme(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        Mail::fake();
        $existante = $this->postJson('/api/intranets/verification/envoyer', ['email' => $admin->email]);
        $inconnue = $this->postJson('/api/intranets/verification/envoyer', ['email' => 'inconnu@societe.test']);

        $existante->assertOk();
        $this->assertSame($existante->json(), $inconnue->json());
        Mail::assertSent(CodeVerificationMail::class, 1);
    }

    public function test_mot_de_passe_oublie_reinitialise_avec_le_code_et_ferme_les_sessions(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        $admin->createToken('intranet');

        $code = $this->codeEnvoye('/api/mot-de-passe/oublie', ['email' => $admin->email]);

        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'email' => $admin->email, 'code' => $code,
            'mot_de_passe' => 'NouveauSecret2026', 'mot_de_passe_confirmation' => 'NouveauSecret2026',
        ])->assertOk();

        $this->assertSame(0, $admin->tokens()->count());
        $this->postJson('/api/login', ['email' => $admin->email, 'mot_de_passe' => 'NouveauSecret2026'])->assertOk();

        // Le code ne sert qu'une fois
        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'email' => $admin->email, 'code' => $code,
            'mot_de_passe' => 'AutreSecret2026ab', 'mot_de_passe_confirmation' => 'AutreSecret2026ab',
        ])->assertStatus(422);
    }

    public function test_mot_de_passe_oublie_ne_revele_pas_si_le_compte_existe(): void
    {
        Mail::fake();
        $r = $this->postJson('/api/mot-de-passe/oublie', ['email' => 'inconnu@societe.test'])->assertOk();

        Mail::assertNothingSent();
        $this->assertStringContainsString('Si cette adresse', $r->json('message'));
    }

    public function test_la_reinitialisation_refuse_un_faux_code_et_un_mot_de_passe_faible(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');
        $code = $this->codeEnvoye('/api/mot-de-passe/oublie', ['email' => $admin->email]);
        $faux = $code === '000000' ? '111111' : '000000';

        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'email' => $admin->email, 'code' => $faux,
            'mot_de_passe' => 'NouveauSecret2026', 'mot_de_passe_confirmation' => 'NouveauSecret2026',
        ])->assertStatus(422);

        $this->postJson('/api/mot-de-passe/reinitialiser', [
            'email' => $admin->email, 'code' => $code,
            'mot_de_passe' => 'court1', 'mot_de_passe_confirmation' => 'court1',
        ])->assertStatus(422)->assertJsonValidationErrors('mot_de_passe');

        // L'ancien mot de passe fonctionne toujours
        $this->assertTrue(Utilisateur::find($admin->id)->is($admin));
        $this->postJson('/api/login', ['email' => $admin->email, 'mot_de_passe' => self::MOT_DE_PASSE])->assertOk();
    }
}

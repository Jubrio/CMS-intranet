<?php

namespace Tests\Feature;

use App\Models\Role;
use Tests\IntranetTestCase;

class AuthTest extends IntranetTestCase
{
    public function test_la_creation_d_un_intranet_prepare_roles_modules_et_administrateur(): void
    {
        $reponse = $this->postJson('/api/intranets', [
            'nom_entreprise' => 'Société Test',
            'nom' => 'Rakoto',
            'prenom' => 'Jean',
            'email' => 'jean@societe.test',
            'mot_de_passe' => 'MotDePasse123!',
            'modules' => ['annuaire'],
        ]);

        $reponse->assertCreated()
            ->assertJsonPath('entreprise.nom', 'Société Test')
            ->assertJsonPath('entreprise.slug', 'societe-test')
            ->assertJsonStructure(['token', 'modules_actifs']);

        // Modules obligatoires + celui demandé, et pas les autres
        $actifs = $reponse->json('modules_actifs');
        foreach (['utilisateurs', 'roles', 'personnalisation', 'annuaire'] as $code) {
            $this->assertContains($code, $actifs);
        }
        $this->assertNotContains('documents', $actifs);

        // Les quatre rôles par défaut existent pour cette entreprise
        $roles = Role::whereHas('entreprise', fn ($q) => $q->where('slug', 'societe-test'))
            ->pluck('nom_role')->all();
        $this->assertEqualsCanonicalizing(['Administrateur', 'RH', 'Manager', 'Employé'], $roles);

        // Le jeton remis fonctionne et désigne l'administrateur
        $this->withToken($reponse->json('token'))->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'jean@societe.test')
            ->assertJsonPath('role', 'Administrateur');
    }

    public function test_deux_entreprises_de_meme_nom_obtiennent_des_adresses_distinctes(): void
    {
        [$a] = $this->creerEntreprise('Doublon');
        [$b] = $this->creerEntreprise('Doublon');

        $this->assertNotSame($a->slug, $b->slug);
    }

    public function test_la_creation_refuse_un_email_deja_utilise_et_un_module_inconnu(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $this->postJson('/api/intranets', [
            'nom_entreprise' => 'Beta', 'nom' => 'X', 'prenom' => 'Y',
            'email' => $admin->email, 'mot_de_passe' => 'MotDePasse123!',
        ])->assertStatus(422)->assertJsonValidationErrors('email');

        $this->postJson('/api/intranets', [
            'nom_entreprise' => 'Beta', 'nom' => 'X', 'prenom' => 'Y',
            'email' => 'neuf@beta.test', 'mot_de_passe' => 'MotDePasse123!',
            'modules' => ['inexistant'],
        ])->assertStatus(422)->assertJsonValidationErrors('modules.0');
    }

    public function test_la_connexion_reussit_et_renvoie_permissions_et_modules(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha', ['documents']);

        $reponse = $this->postJson('/api/login', ['email' => $admin->email, 'mot_de_passe' => self::MOT_DE_PASSE])
            ->assertOk()
            ->assertJsonStructure(['token', 'utilisateur' => ['id', 'role', 'permissions', 'modules_actifs']])
            ->assertJsonPath('utilisateur.role', 'Administrateur')
            ->assertJsonMissingPath('utilisateur.mot_de_passe');

        $this->assertContains('documents.gerer', $reponse->json('utilisateur.permissions'));
        $this->assertContains('documents', $reponse->json('utilisateur.modules_actifs'));
    }

    public function test_la_connexion_refuse_un_mauvais_mot_de_passe_et_un_email_inconnu(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $this->postJson('/api/login', ['email' => $admin->email, 'mot_de_passe' => 'faux'])
            ->assertStatus(401);
        $this->postJson('/api/login', ['email' => 'inconnu@exemple.test', 'mot_de_passe' => self::MOT_DE_PASSE])
            ->assertStatus(401);
    }

    public function test_un_compte_desactive_ou_une_entreprise_suspendue_ne_peut_pas_se_connecter(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé', ['statut_compte' => 'inactif']);

        $this->postJson('/api/login', ['email' => $employe->email, 'mot_de_passe' => self::MOT_DE_PASSE])
            ->assertForbidden();

        $actif = $this->creerUtilisateur($entreprise, 'Employé');
        $entreprise->update(['statut_entreprise' => 'suspendue']);

        $this->postJson('/api/login', ['email' => $actif->email, 'mot_de_passe' => self::MOT_DE_PASSE])
            ->assertForbidden();
    }

    public function test_une_route_protegee_exige_un_jeton(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/menu')->assertUnauthorized();
        $this->getJson('/api/annuaire')->assertUnauthorized();
    }

    public function test_un_jeton_existant_est_refuse_quand_le_compte_est_desactive(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $jeton = $employe->createToken('test')->plainTextToken;

        $this->withToken($jeton)->getJson('/api/me')->assertOk();

        $employe->update(['statut_compte' => 'inactif']);
        $this->app['auth']->forgetGuards(); // sinon le garde réutilise l'utilisateur déjà chargé

        $this->withToken($jeton)->getJson('/api/me')->assertForbidden();
    }

    public function test_un_jeton_existant_est_refuse_quand_l_entreprise_est_suspendue(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $jeton = $employe->createToken('test')->plainTextToken;

        $entreprise->update(['statut_entreprise' => 'suspendue']);

        $this->withToken($jeton)->getJson('/api/me')->assertForbidden();
    }

    public function test_la_deconnexion_revoque_le_jeton(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');

        $jeton = $this->postJson('/api/login', ['email' => $employe->email, 'mot_de_passe' => self::MOT_DE_PASSE])
            ->json('token');

        $this->withToken($jeton)->postJson('/api/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}

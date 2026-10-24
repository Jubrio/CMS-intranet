<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\IntranetTestCase;

/**
 * Matrice des droits des quatre rôles par défaut sur des routes représentatives.
 * Pour les créations, on n'envoie pas de corps valide : un 422 prouve que le rôle
 * est autorisé (la validation passe après les permissions), un 403 qu'il est refusé.
 * Les mises à jour de /personnalisation et /entreprise n'ont que des champs facultatifs :
 * un corps vide y donne 200 pour l'administrateur.
 */
class PermissionsParRoleTest extends IntranetTestCase
{
    /** @return array<string, array{0:string, 1:string, 2:int}> */
    public static function matrice(): array
    {
        $lignes = [
            // [méthode, url, [Employé, Manager, RH, Administrateur]]
            ['GET', '/api/utilisateurs', [403, 403, 200, 200]],
            ['GET', '/api/rh/tableau-de-bord', [403, 403, 200, 200]],
            ['GET', '/api/departements', [403, 403, 200, 200]],
            ['GET', '/api/roles', [403, 403, 403, 200]],
            ['GET', '/api/permissions', [403, 403, 403, 200]],
            ['GET', '/api/modules', [403, 403, 403, 200]],
            ['GET', '/api/menus', [403, 403, 403, 200]],
            ['PUT', '/api/personnalisation', [403, 403, 403, 200]],
            ['PUT', '/api/entreprise', [403, 403, 403, 200]],
            ['POST', '/api/documents', [403, 422, 422, 422]],
            ['POST', '/api/evenements', [403, 422, 422, 422]],
            ['POST', '/api/faq', [403, 403, 422, 422]],
            ['POST', '/api/formulaires', [403, 403, 422, 422]],
            ['GET', '/api/documents', [200, 200, 200, 200]],
            ['GET', '/api/annuaire', [200, 200, 200, 200]],
            ['GET', '/api/faq', [200, 200, 200, 200]],
            ['GET', '/api/me', [200, 200, 200, 200]],
            ['GET', '/api/menu', [200, 200, 200, 200]],
            // Réservé au super-administrateur : personne dans une entreprise
            ['GET', '/api/super/tableau-de-bord', [403, 403, 403, 403]],
            ['GET', '/api/super/intranets', [403, 403, 403, 403]],
            ['GET', '/api/super/modules', [403, 403, 403, 403]],
        ];

        $roles = ['Employé', 'Manager', 'RH', 'Administrateur'];
        $cas = [];
        foreach ($lignes as [$methode, $url, $attendus]) {
            foreach ($roles as $i => $role) {
                $cas["$role $methode $url"] = [$role, $methode.' '.$url, $attendus[$i]];
            }
        }

        return $cas;
    }

    #[DataProvider('matrice')]
    public function test_matrice_des_droits(string $role, string $requete, int $attendu): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['documents', 'annuaire', 'evenements', 'calendrier', 'faq', 'formulaires']);
        $utilisateur = $this->creerUtilisateur($entreprise, $role);
        [$methode, $url] = explode(' ', $requete, 2);

        $this->connecter($utilisateur)->json($methode, $url)->assertStatus($attendu);
    }

    public function test_un_employe_ne_peut_pas_modifier_l_annuaire_mais_le_rh_le_peut(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha', ['annuaire']);
        $cible = $this->creerUtilisateur($entreprise, 'Employé');

        $this->connecter($this->creerUtilisateur($entreprise, 'Employé'))
            ->putJson("/api/annuaire/{$cible->id}", ['poste' => 'Chef'])->assertForbidden();
        $this->connecter($this->creerUtilisateur($entreprise, 'Manager'))
            ->putJson("/api/annuaire/{$cible->id}", ['poste' => 'Chef'])->assertForbidden();

        $this->connecter($this->creerUtilisateur($entreprise, 'RH'))
            ->putJson("/api/annuaire/{$cible->id}", ['poste' => 'Chef'])
            ->assertOk()->assertJsonPath('poste', 'Chef');
    }

    public function test_le_rh_ne_peut_pas_attribuer_un_role_plus_eleve_que_le_sien(): void
    {
        [$entreprise] = $this->creerEntreprise('Alpha');
        $rh = $this->creerUtilisateur($entreprise, 'RH');

        $this->connecter($rh)->postJson('/api/utilisateurs', [
            'nom' => 'Nouveau', 'prenom' => 'Admin', 'email' => 'nouvel.admin@exemple.test',
            'mot_de_passe' => 'MotDePasse123!',
            'role_id' => $this->role($entreprise, 'Administrateur')->id, // RG32
        ])->assertForbidden();
        $this->assertDatabaseMissing('utilisateurs', ['email' => 'nouvel.admin@exemple.test']);

        // Un rôle dont il détient toutes les permissions reste attribuable
        $this->postJson('/api/utilisateurs', [
            'nom' => 'Nouveau', 'prenom' => 'Employé', 'email' => 'nouvel.employe@exemple.test',
            'mot_de_passe' => 'MotDePasse123!',
            'role_id' => $this->role($entreprise, 'Employé')->id,
        ])->assertCreated()->assertJsonPath('role', 'Employé');
    }

    public function test_le_rh_ne_peut_pas_gerer_le_compte_d_un_administrateur(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $rh = $this->creerUtilisateur($entreprise, 'RH');

        $this->connecter($rh)->putJson("/api/utilisateurs/{$admin->id}", ['poste' => 'Piraté'])->assertForbidden();
        $this->putJson("/api/utilisateurs/{$admin->id}/statut", ['actif' => false])->assertForbidden();

        $this->assertSame('actif', $admin->fresh()->statut_compte);
    }

    public function test_le_dernier_administrateur_ne_peut_pas_se_desactiver(): void
    {
        [, $admin] = $this->creerEntreprise('Alpha');

        $this->connecter($admin)->putJson("/api/utilisateurs/{$admin->id}/statut", ['actif' => false])
            ->assertStatus(422);

        $this->assertSame('actif', $admin->fresh()->statut_compte);
    }

    public function test_desactiver_un_compte_revoque_ses_jetons(): void
    {
        [$entreprise, $admin] = $this->creerEntreprise('Alpha');
        $employe = $this->creerUtilisateur($entreprise, 'Employé');
        $employe->createToken('test');

        $this->connecter($admin)->putJson("/api/utilisateurs/{$employe->id}/statut", ['actif' => false])
            ->assertOk()->assertJsonPath('statut_compte', 'inactif');

        $this->assertSame(0, $employe->tokens()->count());
    }
}

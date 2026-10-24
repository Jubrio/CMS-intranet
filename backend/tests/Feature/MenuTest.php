<?php

namespace Tests\Feature;

use App\Models\Entreprise;
use App\Models\Menu;
use App\Models\Module;
use Tests\IntranetTestCase;

/**
 * GET /menu : modules actifs dont le rôle a au moins une permission, réglages de
 * l'administrateur (visibilité, libellé, rôles limités) et liens personnalisés.
 */
class MenuTest extends IntranetTestCase
{
    private Entreprise $entreprise;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->entreprise] = $this->creerEntreprise('Alpha', ['actualites', 'annuaire', 'documents', 'formulaires']);
    }

    private function codes(string $role): array
    {
        $utilisateur = $this->creerUtilisateur($this->entreprise, $role);

        return collect($this->connecter($utilisateur)->getJson('/api/menu')->assertOk()->json('modules'))
            ->pluck('code')->all();
    }

    private function ligneModule(string $code, array $attributs): Menu
    {
        return Menu::create($attributs + [
            'entreprise_id' => $this->entreprise->id,
            'type_menu' => 'module',
            'module_id' => Module::where('code_module', $code)->value('id'),
        ]);
    }

    public function test_un_employe_ne_voit_que_les_modules_actifs_qu_il_peut_consulter(): void
    {
        $this->assertEqualsCanonicalizing(
            ['actualites', 'annuaire', 'documents', 'formulaires'],
            $this->codes('Employé')
        );
    }

    public function test_les_modules_d_administration_n_apparaissent_que_pour_ceux_qui_en_ont_le_droit(): void
    {
        $employe = $this->codes('Employé');
        $rh = $this->codes('RH');
        $admin = $this->codes('Administrateur');

        foreach (['utilisateurs', 'roles', 'personnalisation'] as $code) {
            $this->assertNotContains($code, $employe);
        }
        $this->assertContains('utilisateurs', $rh);
        $this->assertNotContains('roles', $rh);
        $this->assertNotContains('personnalisation', $rh);
        foreach (['utilisateurs', 'roles', 'personnalisation'] as $code) {
            $this->assertContains($code, $admin);
        }
    }

    public function test_un_module_desactive_disparait_du_menu_de_tous(): void
    {
        $this->basculerModule($this->entreprise, 'documents', false);

        $this->assertNotContains('documents', $this->codes('Employé'));
        $this->assertNotContains('documents', $this->codes('Administrateur'));
    }

    public function test_une_entree_masquee_par_l_administrateur_disparait(): void
    {
        $this->ligneModule('actualites', ['visible' => false]);

        $this->assertNotContains('actualites', $this->codes('Employé'));
        $this->assertContains('annuaire', $this->codes('Employé'));
    }

    public function test_le_libelle_et_l_ordre_choisis_par_l_administrateur_sont_appliques(): void
    {
        $this->ligneModule('documents', ['libelle_menu' => 'Bibliothèque', 'ordre_menu' => 1]);

        $utilisateur = $this->creerUtilisateur($this->entreprise, 'Employé');
        $modules = collect($this->connecter($utilisateur)->getJson('/api/menu')->json('modules'));

        $this->assertSame('documents', $modules->first()['code']);   // ordre 1 : en tête
        $this->assertSame('Bibliothèque', $modules->first()['libelle']);
        $this->assertSame('Bibliothèque', $modules->first()['libelle_perso']);

        $autre = $modules->firstWhere('code', 'annuaire');
        $this->assertNull($autre['libelle_perso']);                   // réglage par défaut
        $this->assertSame('Annuaire et organigramme', $autre['libelle']);
    }

    public function test_une_entree_limitee_a_certains_roles_n_est_montree_qu_a_eux(): void
    {
        $ligne = $this->ligneModule('documents', ['roles_limites' => true]);
        $ligne->roles()->attach($this->role($this->entreprise, 'Manager')->id);

        $this->assertContains('documents', $this->codes('Manager'));
        $this->assertNotContains('documents', $this->codes('Employé'));
    }

    public function test_une_entree_limitee_sans_aucun_role_n_est_montree_a_personne(): void
    {
        $this->ligneModule('documents', ['roles_limites' => true]);

        foreach (['Employé', 'Manager', 'RH', 'Administrateur'] as $role) {
            $this->assertNotContains('documents', $this->codes($role));
        }
    }

    public function test_le_menu_ne_donne_jamais_un_droit_que_les_permissions_refusent(): void
    {
        // « Rôles » ouvert à tous dans le menu : l'employé ne le voit toujours pas
        $this->ligneModule('roles', ['visible' => true, 'roles_limites' => false]);

        $this->assertNotContains('roles', $this->codes('Employé'));
    }

    public function test_les_liens_personnalises_respectent_visibilite_et_roles(): void
    {
        $public = Menu::create([
            'entreprise_id' => $this->entreprise->id, 'type_menu' => 'lien',
            'libelle_menu' => 'Webmail', 'url_menu' => 'https://mail.exemple.test', 'ordre_menu' => 5,
        ]);
        Menu::create([
            'entreprise_id' => $this->entreprise->id, 'type_menu' => 'lien',
            'libelle_menu' => 'Caché', 'url_menu' => 'https://cache.exemple.test', 'visible' => false,
        ]);
        $reserve = Menu::create([
            'entreprise_id' => $this->entreprise->id, 'type_menu' => 'lien',
            'libelle_menu' => 'Réservé RH', 'url_menu' => 'https://rh.exemple.test', 'roles_limites' => true,
        ]);
        $reserve->roles()->attach($this->role($this->entreprise, 'RH')->id);

        $liens = fn (string $role) => collect($this->connecter($this->creerUtilisateur($this->entreprise, $role))
            ->getJson('/api/menu')->json('liens'))->pluck('libelle')->all();

        $this->assertSame(['Webmail'], $liens('Employé'));
        $this->assertEqualsCanonicalizing(['Webmail', 'Réservé RH'], $liens('RH'));
        $this->assertSame($public->url_menu, 'https://mail.exemple.test');
    }

    public function test_les_reglages_d_une_entreprise_n_affectent_pas_une_autre(): void
    {
        [$autre] = $this->creerEntreprise('Beta', ['actualites', 'documents']);
        $this->ligneModule('actualites', ['visible' => false]);
        Menu::create([
            'entreprise_id' => $this->entreprise->id, 'type_menu' => 'lien',
            'libelle_menu' => 'Privé Alpha', 'url_menu' => 'https://alpha.exemple.test',
        ]);

        $employeBeta = $this->creerUtilisateur($autre, 'Employé');
        $menu = $this->connecter($employeBeta)->getJson('/api/menu')->assertOk();

        $this->assertContains('actualites', collect($menu->json('modules'))->pluck('code')->all());
        $this->assertSame([], $menu->json('liens'));
        $this->assertNotContains('annuaire', collect($menu->json('modules'))->pluck('code')->all()); // non activé chez Beta
    }

    public function test_le_menu_du_super_administrateur_est_vide(): void
    {
        $this->connecter($this->superAdmin())->getJson('/api/menu')
            ->assertOk()
            ->assertExactJson(['modules' => [], 'liens' => [], 'pages' => []]);
    }
}

<?php

namespace Tests;

use App\Mail\CodeVerificationMail;
use App\Models\Entreprise;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\CodesVerification;
use App\Services\CreationIntranetService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

/**
 * Base des tests Feature : base PostgreSQL remise à zéro, catalogue des modules
 * et super-administrateur semés, et quelques raccourcis pour monter des entreprises.
 */
abstract class IntranetTestCase extends TestCase
{
    use RefreshDatabase;

    public const MOT_DE_PASSE = 'MotDePasse123!';

    private int $compteur = 0;

    /** Fait vérifier une adresse (code reçu puis confirmé) et renvoie le jeton à joindre à la création d'intranet. */
    protected function jetonVerifie(string $email): string
    {
        Mail::fake();
        $codes = app(CodesVerification::class);
        $codes->envoyer($email, CodesVerification::INSCRIPTION);

        $code = null;
        Mail::assertSent(CodeVerificationMail::class, function ($m) use (&$code) {
            $code = $m->code;

            return true;
        });

        return $codes->confirmerInscription($email, $code);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Garde-fou : RefreshDatabase lance migrate:fresh, qui SUPPRIME toutes les tables de la base
     * visée. On refuse donc de continuer si ce n'est pas clairement une base de test
     * (par exemple si DB_DATABASE du système pointe sur la vraie base).
     */
    protected function beforeRefreshingDatabase(): void
    {
        $connexion = config('database.default');
        $base = (string) config("database.connections.{$connexion}.database");

        if (! str_ends_with($base, '_test')) {
            throw new \RuntimeException(
                "Tests interrompus : la base « {$base} » ne se termine pas par « _test ». "
                .'Les tests effacent toutes les tables : utilisez une base dédiée (ex. cms_intranet_test).'
            );
        }
    }

    /**
     * Crée une entreprise comme le fait POST /intranets (même service) :
     * rôles par défaut, modules obligatoires + ceux demandés, administrateur actif.
     *
     * @param  list<string>  $modules  codes des modules facultatifs à activer
     * @return array{0: Entreprise, 1: Utilisateur} l'entreprise et son administrateur
     */
    protected function creerEntreprise(string $nom, array $modules = []): array
    {
        $slug = 'e'.(++$this->compteur);

        [$entreprise, $admin] = app(CreationIntranetService::class)->creer([
            'nom_entreprise' => $nom,
            'nom' => 'Admin',
            'prenom' => $nom,
            'email' => "admin.{$slug}@exemple.test",
            'mot_de_passe' => self::MOT_DE_PASSE,
            'modules' => $modules,
        ]);

        return [$entreprise, $admin];
    }

    /** Crée un compte actif avec l'un des rôles par défaut : Administrateur, RH, Manager, Employé. */
    protected function creerUtilisateur(Entreprise $entreprise, string $nomRole, array $attributs = []): Utilisateur
    {
        $role = Role::where('entreprise_id', $entreprise->id)->where('nom_role', $nomRole)->firstOrFail();
        $n = ++$this->compteur;

        return Utilisateur::create($attributs + [
            'entreprise_id' => $entreprise->id,
            'role_id' => $role->id,
            'nom' => 'Nom'.$n,
            'prenom' => 'Prenom'.$n,
            'email' => "u{$n}@exemple.test",
            'mot_de_passe' => self::MOT_DE_PASSE,
            'statut_compte' => 'actif',
        ]);
    }

    protected function role(Entreprise $entreprise, string $nomRole): Role
    {
        return Role::where('entreprise_id', $entreprise->id)->where('nom_role', $nomRole)->firstOrFail();
    }

    protected function connecter(Utilisateur $utilisateur): static
    {
        Sanctum::actingAs($utilisateur);

        return $this;
    }

    protected function superAdmin(): Utilisateur
    {
        return Utilisateur::where('email', 'superadmin@rcs.local')->firstOrFail();
    }

    protected function basculerModule(Entreprise $entreprise, string $code, bool $actif): void
    {
        $module = Module::where('code_module', $code)->firstOrFail();

        ModuleEntreprise::updateOrCreate(
            ['entreprise_id' => $entreprise->id, 'module_id' => $module->id],
            ['module_actif' => $actif, 'date_activation' => now()]
        );
    }
}

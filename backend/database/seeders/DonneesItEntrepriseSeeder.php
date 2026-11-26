<?php

namespace Database\Seeders;

use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Document;
use App\Models\Entreprise;
use App\Models\Evenement;
use App\Models\Formulaire;
use App\Models\LectureNote;
use App\Models\Module;
use App\Models\Notification;
use App\Models\Personnalisation;
use App\Models\QuestionFaq;
use App\Models\Reponse;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\CreationIntranetService;
use App\Services\FichiersProfil;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Remplit l’intranet « IT Entreprise » avec des données réalistes :
 * 4 départements, ~30 collaborateurs, actualités, annonces, articles, notes de service,
 * pages, documents (vrais fichiers), événements, FAQ, formulaires et réponses, notifications.
 *
 *   php artisan db:seed --class=DonneesItEntrepriseSeeder
 *
 * Tous les comptes ont le mot de passe : Itentreprise123456
 */
class DonneesItEntrepriseSeeder extends Seeder
{
    private const MOT_DE_PASSE = 'Itentreprise123456';

    private Entreprise $entreprise;

    /** @var array<string, Departement> */
    private array $depts = [];

    /** @var array<string, Utilisateur> */
    private array $u = [];

    public function run(): void
    {
        mt_srand(2026);

        if (Module::count() === 0) {
            $this->call(ModuleSeeder::class);
        }

        $this->entreprise = Entreprise::where('slug', 'it-entreprise')->first() ?? $this->creerEntreprise();

        if (Contenu::where('entreprise_id', $this->entreprise->id)->exists()
            || Utilisateur::where('entreprise_id', $this->entreprise->id)->count() > 1) {
            $this->command?->warn('IT Entreprise contient déjà des données : rien n’a été ajouté.');

            return;
        }

        $this->personnaliser();
        $this->creerDepartementsEtUtilisateurs();
        $this->creerContenus();
        $this->creerDocuments();
        $this->creerEvenements();
        $this->creerFaq();
        $this->creerFormulaires();

        $this->command?->info('IT Entreprise : données de démonstration créées.');
        $this->command?->info('Connexion admin : admin@it.mg / '.self::MOT_DE_PASSE);
        $this->command?->info('Autres comptes (ex. hery.rakotoarivelo@it.mg, volana.rasoanaivo@it.mg) : même mot de passe.');
    }

    // ------------------------------------------------------------------ entreprise

    private function creerEntreprise(): Entreprise
    {
        [$entreprise] = app(CreationIntranetService::class)->creer([
            'nom_entreprise' => 'IT Entreprise',
            'email' => 'admin@it.mg',
            'nom' => 'Rakotomalala',
            'prenom' => 'Jean-Claude',
            'mot_de_passe' => self::MOT_DE_PASSE,
            'modules' => Module::auCatalogue()->pluck('code_module')->all(),
        ]);

        return $entreprise;
    }

    private function personnaliser(): void
    {
        Personnalisation::updateOrCreate(
            ['entreprise_id' => $this->entreprise->id],
            ['couleur_principale' => '#0E7490', 'couleur_secondaire' => '#334155'],
        );
    }

    // ------------------------------------------------------------------ départements + utilisateurs

    private function creerDepartementsEtUtilisateurs(): void
    {
        $eid = $this->entreprise->id;

        $admin = Utilisateur::where('email', 'admin@it.mg')->firstOrFail();
        $admin->update([
            'poste' => 'Directeur général',
            'telephone' => '+261 34 11 000 01',
            'date_embauche' => '2016-03-01',
        ]);
        $this->u['admin'] = $admin;

        $definitions = [
            'rh' => ['Ressources humaines et administration', 'Recrutement, paie, formation, vie du personnel et administration générale.'],
            'dev' => ['Développement logiciel', 'Conception et développement des applications web et mobiles livrées à nos clients.'],
            'infra' => ['Infrastructure et réseaux', 'Serveurs, réseaux, sécurité et exploitation des environnements de production.'],
            'support' => ['Support et relation client', 'Assistance de niveau 1 et 2, suivi des tickets et satisfaction des clients.'],
        ];
        foreach ($definitions as $cle => [$nom, $description]) {
            $this->depts[$cle] = Departement::create([
                'entreprise_id' => $eid,
                'nom_departement' => $nom,
                'description_departement' => $description,
            ]);
        }

        $roles = Role::where('entreprise_id', $eid)->pluck('id', 'nom_role');
        $hash = Hash::make(self::MOT_DE_PASSE);

        // cle => [prénom, nom, poste, département, rôle, clé du supérieur, embauche min (année)]
        $equipe = [
            // Ressources humaines
            'volana' => ['Volana', 'Rasoanaivo', 'Responsable des ressources humaines', 'rh', 'RH', 'admin', 2017],
            'lalaina' => ['Lalaina', 'Randrianarisoa', 'Chargée de recrutement', 'rh', 'RH', 'volana', 2021],
            'fanja' => ['Fanja', 'Ratsimbazafy', 'Gestionnaire de paie', 'rh', 'Employé', 'volana', 2020],
            'mamy' => ['Mamy', 'Rakotomalala', 'Assistant administratif', 'rh', 'Employé', 'volana', 2023],
            // Développement
            'hery' => ['Hery', 'Rakotoarivelo', 'Responsable développement', 'dev', 'Manager', 'admin', 2017],
            'andry' => ['Andry', 'Razafindrakoto', 'Développeur backend senior', 'dev', 'Employé', 'hery', 2019],
            'miora' => ['Miora', 'Rabemananjara', 'Développeuse frontend', 'dev', 'Employé', 'hery', 2021],
            'fidy' => ['Fidy', 'Andrianjafy', 'Développeur full-stack', 'dev', 'Employé', 'hery', 2022],
            'njaka' => ['Njaka', 'Rasolofoniaina', 'Développeur mobile Android', 'dev', 'Employé', 'hery', 2022],
            'sitraka' => ['Sitraka', 'Ravelomanana', 'Ingénieure qualité logicielle', 'dev', 'Employé', 'hery', 2021],
            'toky' => ['Toky', 'Rajaonarison', 'Développeur backend', 'dev', 'Employé', 'hery', 2023],
            'haingo' => ['Haingo', 'Razanakolona', 'Designer UX/UI', 'dev', 'Employé', 'hery', 2023],
            'tahina' => ['Tahina', 'Randriamihaja', 'Développeur junior', 'dev', 'Employé', 'hery', 2025],
            // Infrastructure et réseaux
            'rindra' => ['Rindra', 'Andrianasolo', 'Responsable infrastructure', 'infra', 'Manager', 'admin', 2018],
            'tsiory' => ['Tsiory', 'Rakotonirina', 'Administrateur systèmes Linux', 'infra', 'Employé', 'rindra', 2019],
            'faniry' => ['Faniry', 'Rajoelina', 'Ingénieur réseaux', 'infra', 'Employé', 'rindra', 2020],
            'aina' => ['Aina', 'Ramanantsoa', 'Ingénieure cybersécurité', 'infra', 'Employé', 'rindra', 2022],
            'lova' => ['Lova', 'Razafimahatratra', 'Technicien datacenter', 'infra', 'Employé', 'rindra', 2022],
            'mahefa' => ['Mahefa', 'Randriamampionona', 'Ingénieur DevOps', 'infra', 'Employé', 'rindra', 2021],
            'zo' => ['Zo', 'Andriamanana', 'Technicien réseaux', 'infra', 'Employé', 'rindra', 2024],
            // Support et relation client
            'naivo' => ['Naivo', 'Rakotovao', 'Responsable support client', 'support', 'Manager', 'admin', 2018],
            'ony' => ['Ony', 'Ramaroson', 'Technicienne support niveau 2', 'support', 'Employé', 'naivo', 2020],
            'fara' => ['Fara', 'Randrianantenaina', 'Conseillère support niveau 1', 'support', 'Employé', 'naivo', 2022],
            'tojo' => ['Tojo', 'Rasamimanana', 'Conseiller support niveau 1', 'support', 'Employé', 'naivo', 2023],
            'soa' => ['Soa', 'Rakotoarisoa', 'Conseillère support niveau 1', 'support', 'Employé', 'naivo', 2023],
            'mirana' => ['Mirana', 'Rafanomezantsoa', 'Technicien support niveau 2', 'support', 'Employé', 'naivo', 2021],
            'hasina' => ['Hasina', 'Ravoniarivo', 'Chargé de comptes clients', 'support', 'Employé', 'naivo', 2024],
            'nirina' => ['Nirina', 'Andrianarisoa', 'Conseillère support niveau 1', 'support', 'Employé', 'naivo', 2025],
        ];

        foreach ($equipe as $cle => [$prenom, $nom, $poste, $dept, $role, , $annee]) {
            $this->u[$cle] = Utilisateur::create([
                'entreprise_id' => $eid,
                'role_id' => $roles[$role],
                'departement_id' => $this->depts[$dept]->id,
                'nom' => $nom,
                'prenom' => $prenom,
                'email' => Str::slug($prenom.' '.$nom, '.').'@it.mg',
                'mot_de_passe' => $hash,
                'telephone' => '+261 '.['32', '33', '34', '38'][mt_rand(0, 3)].' '.mt_rand(10, 99).' '.mt_rand(100, 999).' '.mt_rand(10, 99),
                'poste' => $poste,
                'date_embauche' => Carbon::create($annee, mt_rand(1, 12), mt_rand(1, 28))->min(now()->subMonths(2))->toDateString(),
                'statut_compte' => 'actif',
            ]);
        }

        foreach ($equipe as $cle => [, , , , , $superieur]) {
            $this->u[$cle]->update(['superieur_id' => $this->u[$superieur]->id]);
        }

        foreach (['rh' => 'volana', 'dev' => 'hery', 'infra' => 'rindra', 'support' => 'naivo'] as $dept => $responsable) {
            $this->depts[$dept]->update(['responsable_id' => $this->u[$responsable]->id]);
        }
    }

    // ------------------------------------------------------------------ contenus

    /** Crée un contenu, fixe sa date et notifie si c’est récent. */
    private function contenu(string $type, string $auteur, string $titre, string $corps, array $o = []): Contenu
    {
        $statut = $o['statut'] ?? 'publie';
        $jours = $o['jours'] ?? 1;
        $date = now()->subDays($jours)->setTime(mt_rand(7, 16), mt_rand(0, 59));
        $dept = isset($o['dept']) ? $this->depts[$o['dept']] : null;

        $c = Contenu::create([
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => $this->u[$auteur]->id,
            'departement_id' => $dept?->id,
            'type_contenu' => $type,
            'titre' => $titre,
            'corps' => $corps,
            'statut_contenu' => $statut,
            'visibilite' => $dept ? 'departement' : 'entreprise',
            'date_publication' => $statut === 'brouillon' ? null : $date,
            'categorie' => $o['categorie'] ?? null,
            'emplacement_menu' => $o['menu'] ?? null,
            'date_expiration' => isset($o['expire']) ? now()->addDays($o['expire'])->toDateString() : null,
            'numero_note' => $o['numero'] ?? null,
        ]);
        $c->forceFill(['created_at' => $date, 'updated_at' => $date])->saveQuietly();

        if ($statut === 'publie' && $jours <= 10 && ! (isset($o['expire']) && $o['expire'] < 0)) {
            $this->notifier($auteur, $type, $c->id, $titre, $dept?->id, $date);
        }

        return $c;
    }

    private function notifier(string $acteur, string $type, int $id, string $titre, ?int $deptId, Carbon $date): void
    {
        app(NotificationService::class)->publier($this->u[$acteur], 'publie', $type, $id, $titre, $deptId);
        Notification::where('objet_type', $type)->where('objet_id', $id)
            ->update(['created_at' => $date, 'updated_at' => $date]);
    }

    private function creerContenus(): void
    {
        $p = fn (string ...$paragraphes): string => implode("\n\n", $paragraphes);

        // ---- Actualités
        $this->contenu('actualite', 'admin', 'Troisième trimestre : une croissance de 18 % du chiffre d’affaires', $p(
            'Chers collègues, le troisième trimestre s’achève sur d’excellents résultats : notre chiffre d’affaires progresse de 18 % par rapport à la même période de l’an dernier, porté par la signature de six nouveaux contrats de maintenance et par le succès de notre offre d’hébergement managé.',
            'Cette performance est avant tout le fruit du travail de chacune et chacun d’entre vous. Les équipes de développement ont livré dans les délais l’ensemble des jalons prévus, l’infrastructure a atteint 99,95 % de disponibilité et le support a maintenu un délai moyen de première réponse inférieur à 20 minutes.',
            'Nous poursuivons nos recrutements au quatrième trimestre, notamment sur les métiers de la cybersécurité et du développement mobile. Les offres sont disponibles auprès des ressources humaines. Merci pour votre engagement.',
        ), ['jours' => 3, 'categorie' => 'Entreprise']);

        $this->contenu('actualite', 'admin', 'Notre nouvelle plateforme de gestion des tickets est en service', $p(
            'Depuis lundi, tous les tickets clients et les demandes internes sont centralisés dans la nouvelle plateforme. Elle remplace l’ancien outil et la boîte mail partagée du support.',
            'Ce qui change pour vous : chaque demande reçoit un numéro de suivi, les priorités sont calculées automatiquement selon l’accord de niveau de service du client, et les managers disposent d’un tableau de bord en temps réel.',
            'Une session de prise en main de 45 minutes est organisée pour chaque département. En cas de difficulté, écrivez à l’équipe support, qui a été formée en premier.',
        ), ['jours' => 10, 'categorie' => 'Outils']);

        $this->contenu('actualite', 'volana', 'Bienvenue à nos quatre nouveaux collègues', $p(
            'Quatre nouvelles personnes ont rejoint IT Entreprise ce mois-ci : un développeur junior dans l’équipe de Hery, une conseillère support dans l’équipe de Naivo, un technicien réseaux chez Rindra et un assistant administratif aux ressources humaines.',
            'Un parcours d’intégration de deux semaines leur a été proposé : présentation de l’entreprise, accès aux outils, rencontre avec chaque département et binôme avec un collègue référent. N’hésitez pas à leur réserver le meilleur accueil et à répondre à leurs questions.',
        ), ['jours' => 6, 'categorie' => 'Vie de l’entreprise']);

        $this->contenu('actualite', 'hery', 'Application mobile : la version 3.2 est en production', $p(
            'Après trois sprints, la version 3.2 de l’application mobile de notre client principal a été déployée sans interruption de service. Elle apporte le mode hors ligne, la synchronisation en arrière-plan et une refonte complète de l’écran d’accueil.',
            'Les premiers retours sont très positifs : la note moyenne sur le store passe de 3,9 à 4,5. Bravo à Njaka, Miora, Sitraka et Haingo pour la qualité de leur travail et leur sens du détail.',
        ), ['jours' => 4, 'dept' => 'dev', 'categorie' => 'Développement']);

        $this->contenu('actualite', 'rindra', 'Migration vers le nouveau datacenter : bilan', $p(
            'La migration de 42 serveurs virtuels vers le nouveau datacenter s’est terminée le week-end dernier. La bascule a duré 6 heures, avec une coupure effective de 11 minutes pour les clients.',
            'Gains attendus : latence réduite de 30 %, doublement de la capacité de sauvegarde et alimentation redondante. L’ancien site sera désactivé dans 30 jours, après une dernière vérification des sauvegardes.',
        ), ['jours' => 8, 'dept' => 'infra', 'categorie' => 'Infrastructure']);

        $this->contenu('actualite', 'naivo', 'Support : 94 % de clients satisfaits en octobre', $p(
            'Le baromètre de satisfaction d’octobre place l’équipe support à 94 % de clients satisfaits ou très satisfaits, contre 89 % en septembre. Le délai moyen de résolution passe sous les 5 heures pour les incidents de priorité haute.',
            'Merci à toute l’équipe. Le prochain objectif est de former chaque conseiller niveau 1 à la prise en charge des demandes de niveau 2 les plus courantes.',
        ), ['jours' => 2, 'dept' => 'support', 'categorie' => 'Support']);

        $this->contenu('actualite', 'admin', 'Inauguration de nos nouveaux locaux d’Antananarivo', $p(
            'Nous avons le plaisir de vous annoncer l’ouverture de nos nouveaux locaux. Ils offrent des espaces de travail plus lumineux, deux salles de réunion supplémentaires, une salle de formation et une zone de détente.',
            'Les plans d’accès et les consignes de stationnement sont disponibles dans la page « Numéros utiles et contacts d’urgence ».',
        ), ['jours' => 40, 'statut' => 'archive', 'categorie' => 'Entreprise']);

        $this->contenu('actualite', 'volana', 'Cérémonie des vœux 2027 : programme provisoire', $p(
            'Le programme de la cérémonie des vœux est en cours de finalisation : discours de la direction, remise des trophées internes, buffet et animation musicale.',
            'À confirmer : lieu, horaires et liste des invités. Brouillon en attente de validation de la direction.',
        ), ['statut' => 'brouillon', 'categorie' => 'Vie de l’entreprise']);

        // ---- Annonces
        $this->contenu('annonce', 'volana', 'Visite médicale annuelle du personnel', $p(
            'La visite médicale annuelle aura lieu du 1er au 12 décembre au centre de santé partenaire. Elle est obligatoire pour tous les collaborateurs.',
            'Merci de prendre rendez-vous auprès des ressources humaines en indiquant deux créneaux possibles. Pensez à apporter votre carnet de santé.',
        ), ['jours' => 2, 'expire' => 20, 'categorie' => 'Ressources humaines']);

        $this->contenu('annonce', 'rindra', 'Maintenance du réseau interne ce week-end', $p(
            'Une maintenance planifiée aura lieu samedi de 20 h à 2 h du matin. Le Wi-Fi, le VPN et l’accès aux serveurs de fichiers pourront être indisponibles par intermittence.',
            'Pensez à enregistrer vos travaux et à fermer vos sessions VPN avant 19 h 30. Aucun travail à distance n’est prévu pendant cette fenêtre.',
        ), ['jours' => 1, 'expire' => 5, 'dept' => 'infra', 'categorie' => 'Informatique']);

        $this->contenu('annonce', 'admin', 'Concours d’innovation interne : à vos idées !', $p(
            'Vous avez une idée pour améliorer nos produits, nos outils ou notre façon de travailler ? Le concours d’innovation interne est ouvert jusqu’à la fin du mois prochain.',
            'Les trois meilleures idées seront financées et développées pendant le premier trimestre 2027. Soumettez la vôtre via le formulaire disponible dans la rubrique Formulaires.',
        ), ['jours' => 5, 'expire' => 35, 'categorie' => 'Innovation']);

        $this->contenu('annonce', 'volana', 'Congés de fin d’année : demandes avant le 5 décembre', $p(
            'Pour permettre une bonne organisation des équipes pendant les fêtes, les demandes de congés de fin d’année doivent être déposées au plus tard le 5 décembre via le formulaire « Demande de congé ».',
            'Chaque manager arbitrera selon les besoins de continuité de service. Les réponses seront communiquées au plus tard le 12 décembre.',
        ), ['jours' => 4, 'expire' => 12, 'categorie' => 'Ressources humaines']);

        $this->contenu('annonce', 'naivo', 'Planning des astreintes de décembre disponible', $p(
            'Le planning des astreintes du support pour le mois de décembre est en ligne dans les documents du département. Merci de vérifier vos dates et de signaler vos indisponibilités avant vendredi.',
        ), ['jours' => 3, 'expire' => 7, 'dept' => 'support', 'categorie' => 'Support']);

        $this->contenu('annonce', 'volana', 'Objets trouvés à l’accueil', $p(
            'Un chargeur d’ordinateur portable et une gourde bleue ont été retrouvés en salle de réunion. Vous pouvez les récupérer auprès de l’accueil.',
        ), ['jours' => 12, 'expire' => -2, 'categorie' => 'Vie pratique']);

        // ---- Articles
        $this->contenu('article', 'hery', 'Bonnes pratiques de revue de code chez IT Entreprise', $p(
            'La revue de code n’est pas un contrôle : c’est un moment d’apprentissage partagé. Voici les règles que nous appliquons dans l’équipe de développement.',
            '1. Des changements petits et ciblés : une demande de fusion ne devrait pas dépasser 400 lignes. Au-delà, la qualité de la relecture chute fortement.',
            '2. Un titre clair et une description qui explique le pourquoi, pas seulement le quoi. Ajoutez des captures d’écran pour les changements d’interface.',
            '3. Les tests passent avant la relecture. Le relecteur ne devrait jamais être le premier à exécuter le code.',
            '4. Des commentaires bienveillants et précis. On critique le code, jamais la personne, et on propose une alternative quand c’est possible.',
            '5. Un délai de réponse de 24 heures ouvrées maximum. Une demande qui attend bloque toute l’équipe.',
        ), ['jours' => 9, 'categorie' => 'Technique']);

        $this->contenu('article', 'rindra', 'Dix réflexes de cybersécurité à adopter au quotidien', $p(
            'La majorité des incidents de sécurité commencent par une erreur humaine. Dix gestes simples permettent d’en éviter l’essentiel.',
            'Verrouillez votre poste dès que vous vous éloignez (Windows + L). Utilisez un gestionnaire de mots de passe et un mot de passe unique par service. Activez l’authentification à deux facteurs partout où elle est proposée.',
            'Méfiez-vous des messages urgents qui demandent un mot de passe ou un virement : vérifiez toujours l’adresse de l’expéditeur et, en cas de doute, appelez la personne. Ne branchez jamais une clé USB trouvée. Installez les mises à jour dès qu’elles sont proposées.',
            'En cas de doute ou d’incident, signalez-le immédiatement à l’équipe infrastructure : plus la réaction est rapide, plus les dégâts sont limités. Aucune sanction n’est liée à un signalement de bonne foi.',
        ), ['jours' => 14, 'dept' => 'infra', 'categorie' => 'Sécurité']);

        $this->contenu('article', 'volana', 'Bien préparer son entretien annuel d’évaluation', $p(
            'L’entretien annuel est le moment de faire le point sur l’année écoulée et de construire la suivante. Il se prépare des deux côtés.',
            'Avant l’entretien : rassemblez vos réalisations marquantes, identifiez vos difficultés, notez les formations qui vous aideraient et réfléchissez à vos envies d’évolution.',
            'Pendant l’entretien : parlez de faits concrets, écoutez les retours sans vous justifier immédiatement et fixez ensemble deux à trois objectifs mesurables pour l’année à venir.',
            'Après l’entretien : le compte rendu est partagé sous huit jours. N’hésitez pas à demander des précisions aux ressources humaines.',
        ), ['jours' => 18, 'categorie' => 'Ressources humaines']);

        $this->contenu('article', 'naivo', 'Gérer un client mécontent : la méthode en cinq étapes', $p(
            'Un client mécontent est une occasion de renforcer la confiance, à condition de bien le traiter. Voici la méthode que nous enseignons aux nouveaux conseillers.',
            '1. Écouter sans interrompre. 2. Reformuler le problème pour montrer qu’il a été compris. 3. S’excuser sincèrement pour la gêne occasionnée, sans chercher de responsable. 4. Proposer une solution ou un plan d’action avec une échéance claire. 5. Faire un suivi après la résolution.',
            'Quelques phrases à éviter : « ce n’est pas notre faute », « vous auriez dû… », « c’est la procédure ». Préférez : « voici ce que je vais faire pour vous ».',
        ), ['jours' => 7, 'dept' => 'support', 'categorie' => 'Relation client']);

        // ---- Notes de service
        $this->contenu('note_service', 'admin', 'Horaires de travail et pointage', $p(
            'À compter du 1er octobre, les horaires de travail sont fixés de 8 h à 17 h du lundi au vendredi, avec une pause déjeuner d’une heure entre 12 h et 14 h.',
            'Le pointage s’effectue à l’arrivée et au départ via le badge. Tout oubli doit être signalé à votre manager dans la journée. Les heures supplémentaires doivent être validées au préalable par le responsable de département.',
        ), ['jours' => 60, 'numero' => 'NS-2026-012', 'categorie' => 'Organisation']);

        $this->contenu('note_service', 'volana', 'Règles de télétravail', $p(
            'Le télétravail est ouvert aux collaborateurs ayant plus de six mois d’ancienneté, dans la limite de deux jours par semaine, après accord du manager.',
            'Le salarié doit disposer d’une connexion stable, utiliser exclusivement le VPN de l’entreprise et rester joignable pendant les horaires habituels. Les équipes support et datacenter, dont la présence sur site est nécessaire, sont exclues du dispositif.',
        ), ['jours' => 45, 'numero' => 'NS-2026-013', 'categorie' => 'Ressources humaines']);

        $this->contenu('note_service', 'admin', 'Politique des mots de passe et double authentification', $p(
            'Afin de renforcer la sécurité du système d’information, les règles suivantes s’appliquent à tous les comptes à compter du 1er novembre.',
            'Mots de passe d’au moins 12 caractères, renouvelés tous les 180 jours, jamais réutilisés d’un service à l’autre. L’authentification à deux facteurs devient obligatoire pour la messagerie, le VPN et les outils d’administration.',
            'Tout manquement constaté peut entraîner la suspension temporaire du compte concerné.',
        ), ['jours' => 20, 'numero' => 'NS-2026-014', 'categorie' => 'Sécurité']);

        $this->contenu('note_service', 'volana', 'Calendrier de fermeture de fin d’année', $p(
            'L’entreprise sera fermée du jeudi 24 décembre au vendredi 1er janvier inclus. Un service minimum d’astreinte est assuré pour les clients sous contrat de disponibilité permanente.',
            'Les jours de fermeture sont imputés à raison de deux jours sur le solde de congés de chaque collaborateur, le reste étant pris en charge par l’entreprise.',
        ), ['jours' => 5, 'numero' => 'NS-2026-015', 'categorie' => 'Organisation']);

        $this->contenu('note_service', 'rindra', 'Accès à la salle des serveurs', $p(
            'L’accès à la salle des serveurs est strictement réservé aux membres de l’équipe infrastructure et aux personnes accompagnées par l’un d’eux.',
            'Toute intervention doit être inscrite dans le registre d’accès avec l’heure d’entrée, l’heure de sortie et le motif. Aucun matériel ne doit sortir de la salle sans bon de sortie signé du responsable.',
        ), ['jours' => 12, 'dept' => 'infra', 'numero' => 'NS-2026-016', 'categorie' => 'Sécurité']);

        // lectures des notes de service
        $notes = Contenu::where('entreprise_id', $this->entreprise->id)->where('type_contenu', 'note_service')->get();
        foreach ($notes as $note) {
            $concernes = collect($this->u)->filter(fn ($x) => $note->departement_id === null || $x->departement_id === $note->departement_id);
            $taux = $note->date_publication->diffInDays(now()) > 15 ? 0.92 : 0.55;
            foreach ($concernes as $x) {
                if ($x->id === $note->auteur_id || mt_rand(1, 100) > $taux * 100) {
                    continue;
                }
                LectureNote::create([
                    'entreprise_id' => $this->entreprise->id,
                    'contenu_id' => $note->id,
                    'utilisateur_id' => $x->id,
                    'date_lecture' => $note->date_publication->copy()->addHours(mt_rand(1, 72)),
                ]);
            }
        }

        // ---- Pages internes
        $this->contenu('page', 'admin', 'Qui sommes-nous ?', $p(
            'IT Entreprise est une société de services numériques fondée en 2016 à Antananarivo. Nous concevons des applications sur mesure, hébergeons et supervisons les systèmes d’information de nos clients et assurons leur support au quotidien.',
            'Notre mission : rendre le numérique simple, fiable et accessible aux entreprises de Madagascar et de l’océan Indien.',
            'Nos valeurs : la rigueur, le sens du service, l’esprit d’équipe et l’amélioration continue. Nous comptons aujourd’hui une trentaine de collaborateurs répartis en quatre départements.',
        ), ['jours' => 90, 'menu' => 'À propos']);

        $this->contenu('page', 'admin', 'Organisation et départements', $p(
            'IT Entreprise s’organise autour de quatre départements placés sous la responsabilité de la direction générale.',
            'Ressources humaines et administration : recrutement, paie, formation, vie du personnel.',
            'Développement logiciel : conception et réalisation des applications web et mobiles.',
            'Infrastructure et réseaux : serveurs, réseaux, sécurité et exploitation.',
            'Support et relation client : assistance, suivi des tickets et satisfaction client.',
            'L’organigramme complet est consultable dans la rubrique Annuaire et organigramme.',
        ), ['jours' => 90, 'menu' => 'À propos']);

        $this->contenu('page', 'admin', 'Charte d’utilisation du système d’information', $p(
            'Cette charte précise les droits et devoirs de chaque utilisateur du système d’information de l’entreprise.',
            'Usage professionnel : les ressources informatiques sont destinées à un usage professionnel. Un usage personnel raisonnable est toléré s’il ne gêne pas le travail ni la sécurité.',
            'Confidentialité : les données clients et les informations internes ne doivent jamais être partagées via des services non autorisés (messageries personnelles, stockage en ligne grand public).',
            'Matériel : chacun est responsable du poste qui lui est confié. Toute perte ou tout vol doit être signalé sous 24 heures.',
            'Contrôle : l’entreprise peut analyser les journaux de connexion à des fins de sécurité, dans le respect de la vie privée des collaborateurs.',
        ), ['jours' => 70, 'menu' => 'Informatique']);

        $this->contenu('page', 'volana', 'Guide d’intégration des nouveaux arrivants', $p(
            'Bienvenue chez IT Entreprise ! Ce guide vous accompagne pendant vos premières semaines.',
            'Jour 1 : accueil par les ressources humaines, remise du badge et du matériel, présentation de l’équipe. Jour 2 : accès aux outils (messagerie, tickets, intranet) et lecture de la charte informatique.',
            'Semaine 1 : rencontre avec chaque responsable de département et désignation d’un collègue référent. Semaines 2 et 3 : prise en main des projets en cours. Fin du premier mois : point d’étape avec votre manager.',
            'Une question ? Consultez la FAQ ou contactez les ressources humaines.',
        ), ['jours' => 60, 'menu' => 'Ressources humaines']);

        $this->contenu('page', 'volana', 'Procédure de demande et de validation des congés', $p(
            'Toute absence doit être demandée à l’avance via le formulaire « Demande de congé » disponible dans la rubrique Formulaires.',
            'Étapes : 1) vous déposez la demande au moins 15 jours à l’avance pour un congé annuel ; 2) votre manager l’examine sous 3 jours ouvrés ; 3) les ressources humaines enregistrent le congé et mettent à jour votre solde.',
            'En cas de maladie, prévenez votre manager le jour même et transmettez le certificat médical sous 48 heures. Les congés exceptionnels (mariage, naissance, décès) sont accordés selon la convention en vigueur.',
        ), ['jours' => 55, 'menu' => 'Ressources humaines']);

        $this->contenu('page', 'admin', 'Numéros utiles et contacts d’urgence', $p(
            'Accueil : poste 100. Support informatique interne : poste 200 ou support@it.mg. Ressources humaines : poste 300 ou rh@it.mg.',
            'Astreinte infrastructure (hors heures ouvrées, incidents critiques uniquement) : +261 34 11 000 99.',
            'Sécurité des locaux : poste 150. En cas d’urgence médicale ou d’incendie, appelez d’abord les secours, puis prévenez l’accueil.',
        ), ['jours' => 30, 'menu' => 'Vie pratique']);
    }

    // ------------------------------------------------------------------ documents

    private function document(string $auteur, string $nom, string $categorie, array $lignes, ?string $dept = null): void
    {
        $contenu = mb_strtoupper($nom)."\nIT Entreprise — document interne\n\n".implode("\n\n", $lignes)."\n";
        $chemin = 'documents/'.$this->entreprise->id.'/'.Str::slug($nom).'.txt';
        Storage::disk(FichiersProfil::DISQUE)->put($chemin, $contenu);

        $date = now()->subDays(mt_rand(3, 80));
        $d = Document::create([
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => $this->u[$auteur]->id,
            'departement_id' => $dept ? $this->depts[$dept]->id : null,
            'nom_document' => $nom,
            'fichier' => $chemin,
            'type_mime' => 'text/plain',
            'taille_fichier' => max(1, (int) ceil(strlen($contenu) / 1024)),
            'categorie' => $categorie,
            'visibilite' => $dept ? 'departement' : 'entreprise',
        ]);
        $d->forceFill(['created_at' => $date, 'updated_at' => $date])->saveQuietly();

        if ($date->diffInDays(now()) <= 10) {
            $this->notifier($auteur, 'document', $d->id, $nom, $dept ? $this->depts[$dept]->id : null, $date);
        }
    }

    private function creerDocuments(): void
    {
        $this->document('volana', 'Règlement intérieur', 'Règlements', [
            'Article 1 — Champ d’application : le présent règlement s’applique à l’ensemble du personnel d’IT Entreprise, quel que soit son contrat.',
            'Article 2 — Horaires : 8 h à 17 h du lundi au vendredi, pause déjeuner d’une heure.',
            'Article 3 — Absences : toute absence doit être justifiée auprès du manager et des ressources humaines dans les 48 heures.',
            'Article 4 — Sécurité : le port du badge est obligatoire dans les locaux. Les visiteurs sont accompagnés en permanence.',
            'Article 5 — Discipline : les manquements au règlement peuvent donner lieu à un avertissement, un blâme ou une mise à pied selon leur gravité.',
        ]);
        $this->document('volana', 'Modèle de demande de congé', 'Modèles', [
            'Nom et prénom : ______________________    Département : ______________________',
            'Type de congé : annuel / maladie / sans solde / exceptionnel',
            'Du : ____ / ____ / ________    Au : ____ / ____ / ________    Nombre de jours : ______',
            'Personne assurant l’intérim : ______________________',
            'Avis du manager : favorable / défavorable    Date et signature : ______________________',
        ]);
        $this->document('volana', 'Modèle de note de frais', 'Modèles', [
            'Collaborateur : ______________________    Mission : ______________________',
            'Date | Nature de la dépense | Montant (Ar) | Justificatif joint (oui/non)',
            'Les frais doivent être déposés sous 15 jours avec les justificatifs originaux. Le remboursement intervient avec la paie du mois suivant.',
        ]);
        $this->document('admin', 'Politique de sécurité de l’information', 'Sécurité', [
            '1. Objectif : protéger la confidentialité, l’intégrité et la disponibilité des informations de l’entreprise et de ses clients.',
            '2. Classification : les données sont classées en publiques, internes, confidentielles et critiques. Les données confidentielles et critiques sont chiffrées au repos et en transit.',
            '3. Accès : le principe du moindre privilège s’applique. Les droits sont revus chaque trimestre par les responsables de département.',
            '4. Sauvegardes : sauvegarde quotidienne, copie hors site hebdomadaire, test de restauration mensuel.',
            '5. Incidents : tout incident est signalé à l’équipe infrastructure et consigné dans le registre des incidents.',
        ]);
        $this->document('admin', 'Plan de continuité d’activité', 'Sécurité', [
            'Ce plan décrit les mesures permettant de maintenir les services critiques en cas de sinistre : coupure d’électricité prolongée, panne majeure de l’infrastructure, indisponibilité des locaux.',
            'Services critiques : hébergement des clients, supervision, support de niveau 1. Objectif de reprise : moins de 4 heures.',
            'Cellule de crise : direction générale, responsable infrastructure, responsable support. Chaîne d’appel mise à jour chaque trimestre.',
        ]);
        $this->document('rindra', 'Procédure d’astreinte et d’escalade', 'Procédures', [
            'Niveau 1 : le conseiller support de garde qualifie l’incident et applique la procédure standard sous 15 minutes.',
            'Niveau 2 : si l’incident n’est pas résolu en 30 minutes, escalade vers l’ingénieur d’astreinte de l’équipe infrastructure.',
            'Niveau 3 : incident critique ou impact multi-clients, appel du responsable infrastructure puis de la direction générale.',
            'Chaque incident fait l’objet d’un compte rendu sous 48 heures.',
        ], 'infra');
        $this->document('hery', 'Guide de contribution Git et conventions de code', 'Techniques', [
            'Branches : main (production), develop (intégration), feature/<ticket>-<description> pour chaque évolution.',
            'Messages de commit : format « type(portée): résumé » (feat, fix, docs, refactor, test), 72 caractères maximum pour la première ligne.',
            'Demandes de fusion : une relecture obligatoire, intégration continue au vert, couverture de tests non régressive.',
            'Style : formatage automatique avant chaque commit, pas de secret ou de mot de passe dans le dépôt.',
        ], 'dev');
        $this->document('naivo', 'Script d’accueil et réponses types du support', 'Procédures', [
            'Accueil : « IT Entreprise bonjour, [prénom] à votre service. Pouvez-vous me donner le numéro de votre contrat ? »',
            'Qualification : identifier le client, le système concerné, le moment où le problème a débuté, le message d’erreur exact et l’impact métier.',
            'Clôture : résumer l’action réalisée, confirmer avec le client que le problème est résolu et lui rappeler le numéro de ticket.',
        ], 'support');
    }

    // ------------------------------------------------------------------ événements

    private function evenement(string $auteur, string $titre, string $description, Carbon $debut, Carbon $fin, string $lieu, ?string $dept = null): void
    {
        $e = Evenement::create([
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => $this->u[$auteur]->id,
            'departement_id' => $dept ? $this->depts[$dept]->id : null,
            'titre_evenement' => $titre,
            'description_evenement' => $description,
            'date_debut' => $debut,
            'date_fin' => $fin,
            'lieu' => $lieu,
            'visibilite' => $dept ? 'departement' : 'entreprise',
        ]);
        $creation = $debut->copy()->subDays(mt_rand(5, 14))->min(now()->subHours(3));
        $e->forceFill(['created_at' => $creation, 'updated_at' => $creation])->saveQuietly();

        if ($debut->isFuture() && now()->diffInDays($debut) <= 14) {
            $this->notifier($auteur, 'evenement', $e->id, $titre, $dept ? $this->depts[$dept]->id : null, $creation);
        }
    }

    private function creerEvenements(): void
    {
        $j = fn (int $jours, int $h, int $m = 0): Carbon => now()->startOfDay()->addDays($jours)->setTime($h, $m);

        // passés
        $this->evenement('volana', 'Journée d’intégration des nouveaux collaborateurs', 'Présentation de l’entreprise, visite des locaux et déjeuner avec les équipes.', $j(-13, 9), $j(-13, 16), 'Salle de formation');
        $this->evenement('admin', 'Séminaire stratégie 2027', 'Revue des résultats et définition des priorités de l’année prochaine avec les responsables de département.', $j(-5, 8, 30), $j(-5, 17), 'Salle de conférence');
        // à venir
        $this->evenement('hery', 'Revue de sprint — équipe développement', 'Démonstration des fonctionnalités livrées et rétrospective du sprint.', $j(4, 15), $j(4, 16, 30), 'Salle de réunion 2', 'dev');
        $this->evenement('admin', 'Point mensuel de l’entreprise', 'Résultats du mois, projets en cours et questions-réponses avec la direction.', $j(4, 9), $j(4, 10, 30), 'Salle de conférence');
        $this->evenement('rindra', 'Maintenance planifiée du réseau interne', 'Mise à jour du cœur de réseau et remplacement de deux commutateurs. Interruptions possibles.', $j(5, 20), $j(6, 2), 'Salle des serveurs', 'infra');
        $this->evenement('volana', 'Formation : reconnaître et signaler le phishing', 'Atelier pratique de trois heures avec simulations d’attaques. Présence obligatoire.', $j(9, 14), $j(9, 17), 'Salle de formation');
        $this->evenement('naivo', 'Atelier : bien utiliser la plateforme de tickets', 'Prise en main avancée : priorités, accords de service, tableaux de bord.', $j(11, 10), $j(11, 11, 30), 'Salle de réunion 1', 'support');
        $this->evenement('hery', 'Déjeuner d’équipe de fin d’année — Développement', 'Repas offert par l’entreprise pour célébrer les livraisons de l’année.', $j(19, 12), $j(19, 14, 30), 'Restaurant « Le Jardin »', 'dev');
        $this->evenement('admin', 'Arbre de Noël du personnel', 'Goûter, animations pour les enfants et remise des trophées internes.', $j(26, 15), $j(26, 19), 'Salle polyvalente');
        $this->evenement('volana', 'Fermeture de l’entreprise (fêtes de fin d’année)', 'Fermeture du 24 décembre au 1er janvier inclus. Astreinte maintenue pour les contrats de disponibilité permanente.', $j(31, 17), $j(39, 18), 'Entreprise');
        $this->evenement('volana', 'Entretiens annuels d’évaluation', 'Période des entretiens individuels. Les créneaux sont à réserver auprès de votre manager.', $j(45, 8), $j(52, 17), 'Salles de réunion');
    }

    // ------------------------------------------------------------------ FAQ

    private function creerFaq(): void
    {
        $faq = [
            ['Congés et absences', 'Combien de jours de congé ai-je par an ?', 'Vous disposez de 30 jours calendaires de congé annuel par an, soit 2,5 jours par mois travaillé. Votre solde est communiqué chaque mois avec votre bulletin de paie.'],
            ['Congés et absences', 'Comment poser un congé ?', 'Remplissez le formulaire « Demande de congé » dans la rubrique Formulaires au moins 15 jours à l’avance. Votre manager répond sous 3 jours ouvrés, puis les ressources humaines enregistrent le congé.'],
            ['Congés et absences', 'Que faire si je suis malade ?', 'Prévenez votre manager le jour même, avant 9 h si possible, puis transmettez votre certificat médical aux ressources humaines sous 48 heures.'],
            ['Paie et avantages', 'À quelle date la paie est-elle versée ?', 'Le salaire est versé le 28 de chaque mois, ou le dernier jour ouvré précédent si le 28 tombe un week-end. Le bulletin est disponible auprès des ressources humaines.'],
            ['Paie et avantages', 'Comment me faire rembourser mes frais professionnels ?', 'Téléchargez le modèle de note de frais dans la rubrique Documents, joignez les justificatifs originaux et remettez-la aux ressources humaines sous 15 jours. Le remboursement est versé avec la paie suivante.'],
            ['Paie et avantages', 'L’entreprise propose-t-elle une assurance santé ?', 'Oui. Tous les collaborateurs en CDI sont couverts après leur période d’essai. L’entreprise prend en charge 70 % de la cotisation. Les modalités détaillées sont disponibles auprès des ressources humaines.'],
            ['Informatique', 'J’ai oublié mon mot de passe, que faire ?', 'Utilisez le lien « Mot de passe oublié » sur la page de connexion : un code vous sera envoyé par e-mail. Si vous n’avez plus accès à votre messagerie, contactez le support interne au poste 200.'],
            ['Informatique', 'Comment me connecter au VPN depuis chez moi ?', 'Installez le client VPN fourni par l’entreprise, saisissez votre identifiant et validez le second facteur sur votre téléphone. Le guide d’installation est disponible dans la page « Charte d’utilisation du système d’information ».'],
            ['Informatique', 'Comment demander du matériel informatique ?', 'Utilisez le formulaire « Demande de matériel informatique ». Le traitement prend en moyenne 5 jours ouvrés, et 48 heures pour les demandes urgentes justifiées.'],
            ['Informatique', 'Que faire en cas d’e-mail suspect ?', 'Ne cliquez sur aucun lien et n’ouvrez aucune pièce jointe. Transférez le message à securite@it.mg puis supprimez-le. Si vous avez déjà cliqué, prévenez immédiatement l’équipe infrastructure.'],
            ['Télétravail', 'Puis-je travailler à distance ?', 'Oui, jusqu’à deux jours par semaine après six mois d’ancienneté et avec l’accord de votre manager. Les équipes support et datacenter sont exclues du dispositif. Voir la note de service NS-2026-013.'],
            ['Vie pratique', 'Quels sont les horaires de l’entreprise ?', 'Du lundi au vendredi, de 8 h à 17 h, avec une pause déjeuner d’une heure entre 12 h et 14 h.'],
            ['Vie pratique', 'Où puis-je déjeuner sur place ?', 'Une salle de pause équipée d’un réfrigérateur, de micro-ondes et d’une machine à café est disponible au rez-de-chaussée. Plusieurs restaurants se trouvent à moins de 5 minutes à pied.'],
            ['Vie pratique', 'Comment réserver une salle de réunion ?', 'Les salles se réservent via le calendrier de l’intranet en créant un événement avec le lieu souhaité. Prévenez l’accueil pour les rendez-vous avec des visiteurs externes.'],
            ['Formation et carrière', 'Comment demander une formation ?', 'Parlez-en d’abord à votre manager lors de l’entretien annuel ou en cours d’année. Le budget formation est de 5 jours par collaborateur et par an, validé par les ressources humaines.'],
        ];

        foreach ($faq as $i => [$categorie, $question, $reponse]) {
            $date = now()->subDays(75 - $i * 4);
            $auteur = $i % 3 === 2 ? 'lalaina' : ($i % 5 === 4 ? 'admin' : 'volana');
            $q = QuestionFaq::create([
                'entreprise_id' => $this->entreprise->id,
                'auteur_id' => $this->u[$auteur]->id,
                'categorie' => $categorie,
                'question' => $question,
                'reponse' => $reponse,
            ]);
            $q->forceFill(['created_at' => $date, 'updated_at' => $date])->saveQuietly();
            if ($date->diffInDays(now()) <= 10) {
                $this->notifier($auteur, 'faq', $q->id, $question, null, $date);
            }
        }
    }

    // ------------------------------------------------------------------ formulaires + réponses

    private function formulaire(string $auteur, string $titre, array $champs, array $o = []): Formulaire
    {
        $dept = isset($o['dept']) ? $this->depts[$o['dept']] : null;
        $date = now()->subDays($o['jours'] ?? 30);
        $f = Formulaire::create([
            'entreprise_id' => $this->entreprise->id,
            'auteur_id' => $this->u[$auteur]->id,
            'departement_id' => $dept?->id,
            'titre_formulaire' => $titre,
            'champs' => $champs,
            'visibilite' => $dept ? 'departement' : 'entreprise',
            'reponse_unique' => $o['unique'] ?? false,
            'date_limite' => isset($o['limite']) ? now()->addDays($o['limite'])->toDateString() : null,
            'statut_formulaire' => $o['statut'] ?? 'publie',
        ]);
        $f->forceFill(['created_at' => $date, 'updated_at' => $date])->saveQuietly();

        return $f;
    }

    /** @param  list<string>  $repondants */
    private function repondre(Formulaire $f, array $repondants, callable $valeurs): void
    {
        foreach ($repondants as $cle) {
            $date = now()->subDays(mt_rand(0, 9))->setTime(mt_rand(8, 17), mt_rand(0, 59));
            $r = Reponse::create([
                'formulaire_id' => $f->id,
                'entreprise_id' => $this->entreprise->id,
                'utilisateur_id' => $this->u[$cle]->id,
                'valeurs' => $valeurs($cle),
            ]);
            $r->forceFill(['created_at' => $date, 'updated_at' => $date])->saveQuietly();
        }
    }

    private function creerFormulaires(): void
    {
        $choix = fn (array $a) => $a[mt_rand(0, count($a) - 1)];

        // 1. Demande de congé
        $conge = $this->formulaire('volana', 'Demande de congé', [
            ['nom' => 'type_conge', 'libelle' => 'Type de congé', 'type' => 'choix_unique', 'obligatoire' => true,
                'options' => ['Congé annuel', 'Congé maladie', 'Congé sans solde', 'Congé exceptionnel', 'Permission']],
            ['nom' => 'date_debut', 'libelle' => 'Date de début', 'type' => 'date', 'obligatoire' => true],
            ['nom' => 'date_fin', 'libelle' => 'Date de fin', 'type' => 'date', 'obligatoire' => true],
            ['nom' => 'nombre_jours', 'libelle' => 'Nombre de jours ouvrés', 'type' => 'nombre', 'obligatoire' => true],
            ['nom' => 'interim', 'libelle' => 'Personne assurant l’intérim', 'type' => 'texte', 'obligatoire' => false],
            ['nom' => 'motif', 'libelle' => 'Précisions (facultatif)', 'type' => 'texte_long', 'obligatoire' => false],
        ], ['jours' => 60]);
        $this->repondre($conge, ['andry', 'miora', 'njaka', 'tsiory', 'aina', 'fara', 'soa', 'fanja', 'sitraka', 'hasina'], function ($cle) use ($choix) {
            $debut = now()->addDays(mt_rand(10, 45));
            $jours = mt_rand(1, 8);

            return [
                'type_conge' => $choix(['Congé annuel', 'Congé annuel', 'Congé annuel', 'Permission', 'Congé exceptionnel']),
                'date_debut' => $debut->toDateString(),
                'date_fin' => $debut->copy()->addDays($jours)->toDateString(),
                'nombre_jours' => $jours,
                'interim' => $choix(['Andry R.', 'Mahefa R.', 'Ony R.', 'Fidy A.']),
                'motif' => $choix(['Congés de fin d’année en famille.', 'Voyage à Nosy Be.', 'Démarches administratives.', 'Mariage d’un proche.']),
            ];
        });

        // 2. Demande de matériel informatique
        $materiel = $this->formulaire('admin', 'Demande de matériel informatique', [
            ['nom' => 'type_materiel', 'libelle' => 'Type de matériel', 'type' => 'choix_unique', 'obligatoire' => true,
                'options' => ['Ordinateur portable', 'Écran', 'Clavier et souris', 'Casque audio', 'Téléphone', 'Autre']],
            ['nom' => 'urgence', 'libelle' => 'Niveau d’urgence', 'type' => 'choix_unique', 'obligatoire' => true, 'options' => ['Normale', 'Urgente']],
            ['nom' => 'justification', 'libelle' => 'Justification de la demande', 'type' => 'texte_long', 'obligatoire' => true],
        ], ['jours' => 45]);
        $this->repondre($materiel, ['tahina', 'haingo', 'tojo', 'zo', 'nirina'], fn ($cle) => [
            'type_materiel' => $choix(['Écran', 'Casque audio', 'Clavier et souris', 'Ordinateur portable']),
            'urgence' => $choix(['Normale', 'Normale', 'Urgente']),
            'justification' => $choix(['Mon matériel actuel est défectueux depuis deux semaines.', 'Besoin d’un second écran pour les revues de design.', 'Casque nécessaire pour les appels clients.', 'Remplacement d’un poste de plus de 5 ans.']),
        ]);

        // 3. Déclaration d’incident informatique
        $incident = $this->formulaire('admin', 'Déclaration d’incident informatique', [
            ['nom' => 'date_incident', 'libelle' => 'Date de l’incident', 'type' => 'date', 'obligatoire' => true],
            ['nom' => 'gravite', 'libelle' => 'Gravité', 'type' => 'choix_unique', 'obligatoire' => true, 'options' => ['Mineure', 'Majeure', 'Critique']],
            ['nom' => 'systemes', 'libelle' => 'Systèmes impactés', 'type' => 'choix_multiple', 'obligatoire' => true,
                'options' => ['Messagerie', 'VPN', 'Réseau interne', 'Serveur de fichiers', 'Application métier', 'Poste de travail']],
            ['nom' => 'description', 'libelle' => 'Description de l’incident', 'type' => 'texte_long', 'obligatoire' => true],
        ], ['jours' => 45]);
        $this->repondre($incident, ['miora', 'ony', 'mamy', 'lova'], fn ($cle) => [
            'date_incident' => now()->subDays(mt_rand(1, 8))->toDateString(),
            'gravite' => $choix(['Mineure', 'Mineure', 'Majeure']),
            'systemes' => $choix([['VPN'], ['Messagerie', 'Poste de travail'], ['Réseau interne'], ['Serveur de fichiers']]),
            'description' => $choix(['Connexion VPN impossible depuis ce matin malgré un second facteur valide.', 'Les e-mails envoyés restent bloqués dans la boîte d’envoi.', 'Le partage réseau est très lent depuis la migration.', 'Le poste redémarre seul plusieurs fois par jour.']),
        ]);

        // 4. Enquête de satisfaction (réponse unique)
        $enquete = $this->formulaire('volana', 'Enquête de satisfaction interne — quatrième trimestre 2026', [
            ['nom' => 'satisfaction', 'libelle' => 'Globalement, comment évaluez-vous votre satisfaction au travail ?', 'type' => 'choix_unique', 'obligatoire' => true,
                'options' => ['Très satisfait', 'Satisfait', 'Neutre', 'Insatisfait']],
            ['nom' => 'axes', 'libelle' => 'Quels sujets faut-il améliorer en priorité ?', 'type' => 'choix_multiple', 'obligatoire' => false,
                'options' => ['Communication interne', 'Outils de travail', 'Formation', 'Équilibre vie professionnelle et personnelle', 'Rémunération et avantages']],
            ['nom' => 'suggestions', 'libelle' => 'Vos suggestions', 'type' => 'texte_long', 'obligatoire' => false],
        ], ['jours' => 6, 'unique' => true, 'limite' => 12]);
        $this->repondre($enquete, ['andry', 'miora', 'fidy', 'njaka', 'sitraka', 'toky', 'haingo', 'tsiory', 'faniry', 'aina', 'mahefa', 'ony', 'fara', 'tojo', 'soa', 'fanja', 'lalaina', 'mirana'], fn ($cle) => [
            'satisfaction' => $choix(['Très satisfait', 'Satisfait', 'Satisfait', 'Satisfait', 'Neutre', 'Insatisfait']),
            'axes' => $choix([['Formation'], ['Outils de travail', 'Communication interne'], ['Rémunération et avantages'], ['Équilibre vie professionnelle et personnelle', 'Formation'], ['Communication interne']]),
            'suggestions' => $choix(['Plus de formations techniques en interne.', 'Un point d’équipe hebdomadaire plus court.', 'Des espaces de travail plus calmes.', 'Rien de particulier, tout va bien.', 'Davantage de transparence sur les projets en cours.']),
        ]);

        // 5. Inscription au team building (réponse unique)
        $team = $this->formulaire('admin', 'Inscription à la sortie d’équipe de décembre', [
            ['nom' => 'participation', 'libelle' => 'Participerez-vous à la sortie ?', 'type' => 'choix_unique', 'obligatoire' => true, 'options' => ['Oui', 'Non', 'Peut-être']],
            ['nom' => 'accompagnants', 'libelle' => 'Nombre d’accompagnants', 'type' => 'nombre', 'obligatoire' => false],
            ['nom' => 'regime', 'libelle' => 'Régime alimentaire', 'type' => 'choix_unique', 'obligatoire' => false, 'options' => ['Aucun', 'Végétarien', 'Sans porc', 'Autre']],
        ], ['jours' => 4, 'unique' => true, 'limite' => 9]);
        $this->repondre($team, ['hery', 'andry', 'miora', 'fidy', 'njaka', 'toky', 'rindra', 'tsiory', 'faniry', 'lova', 'naivo', 'ony', 'fara', 'volana'], fn ($cle) => [
            'participation' => $choix(['Oui', 'Oui', 'Oui', 'Peut-être', 'Non']),
            'accompagnants' => mt_rand(0, 3),
            'regime' => $choix(['Aucun', 'Aucun', 'Aucun', 'Végétarien', 'Sans porc']),
        ]);

        // 6. Brouillon : évaluation annuelle
        $this->formulaire('volana', 'Auto-évaluation annuelle 2026', [
            ['nom' => 'realisations', 'libelle' => 'Vos principales réalisations de l’année', 'type' => 'texte_long', 'obligatoire' => true],
            ['nom' => 'difficultes', 'libelle' => 'Les difficultés rencontrées', 'type' => 'texte_long', 'obligatoire' => false],
            ['nom' => 'formations', 'libelle' => 'Formations souhaitées', 'type' => 'texte', 'obligatoire' => false],
        ], ['jours' => 1, 'statut' => 'brouillon', 'limite' => 30]);
    }
}

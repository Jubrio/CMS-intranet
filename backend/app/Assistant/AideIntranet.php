<?php

namespace App\Assistant;

use App\Models\Utilisateur;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Aide sur le fonctionnement de l'intranet : quand la question est une demande d'explication (« comment fonctionne… »,
 * « c'est quoi… », « que peux-tu faire »), on joint au modèle les passages utiles de ce document, adaptés au rôle de la
 * personne. Le modèle répond uniquement à partir de ces informations : il n'invente pas de fonctionnalité.
 */
class AideIntranet
{
    private const MOTIFS = [
        '/\bcomment\b(?! s appel| se nomm| va | allez| ca va| t appel| vous appel)/',
        '/\b(fonctionnement|mode d emploi|tutoriel)\b/',
        '/^(c est quoi|cest quoi|qu est ce|quest ce|a quoi sert|a quoi servent|pourquoi|difference|quelle est la difference|que peux tu|que sais tu|que fais tu|aide moi|besoin d aide|help|presente|explique)/',
        '/\b(c est quoi|a quoi sert|a quoi servent)\b/',
        '/\bquels? sont (les )?(roles|modules|fonctionnalites|droits|permissions)\b/',
    ];

    private const ACCES_GERER = [
        'utilisateurs.gerer' => 'les utilisateurs', 'utilisateurs.departements' => 'les départements', 'roles.gerer' => 'les rôles et permissions',
        'actualites.publier' => 'les actualités', 'annonces.publier' => 'les annonces', 'articles.publier' => 'les articles',
        'notes_service.publier' => 'les notes de service', 'pages.gerer' => 'les pages internes', 'documents.gerer' => 'les documents',
        'evenements.gerer' => 'les événements', 'faq.gerer' => 'la FAQ', 'formulaires.gerer' => 'les formulaires', 'annuaire.gerer' => "l'annuaire",
        'personnalisation.modules' => 'les modules', 'personnalisation.apparence' => "l'apparence", 'personnalisation.parametres' => 'les menus et paramètres',
    ];

    private const ACCES_CONSULTER = [
        'actualites.consulter' => 'les actualités', 'annonces.consulter' => 'les annonces', 'articles.consulter' => 'les articles',
        'notes_service.consulter' => 'les notes de service', 'annuaire.consulter' => "l'annuaire", 'calendrier.consulter' => 'le calendrier',
        'documents.consulter' => 'les documents', 'evenements.consulter' => 'les événements', 'faq.consulter' => 'la FAQ',
        'pages.consulter' => 'les pages internes', 'formulaires.repondre' => 'les formulaires à remplir',
    ];

    private const MODULES = [
        'actualites' => 'Actualités', 'annonces' => 'Annonces', 'articles' => 'Articles', 'notes_service' => 'Notes de service',
        'pages' => 'Pages internes', 'documents' => 'Documents', 'evenements' => 'Événements', 'calendrier' => 'Calendrier',
        'faq' => 'FAQ', 'formulaires' => 'Formulaires', 'annuaire' => 'Annuaire', 'utilisateurs' => 'Utilisateurs', 'roles' => 'Rôles',
    ];

    /** @var array<string, array{mots: list<string>, titre: string, texte: string}> */
    private const SUJETS = [
        'general' => [
            'mots' => ['intranet', 'fonctionne', 'fonctionnement', 'c est quoi', 'presentation', 'plateforme', 'cms', 'tableau de bord', 'accueil', 'connexion', 'espace'],
            'titre' => "Présentation de l'intranet",
            'texte' => "L'intranet est l'espace de travail privé d'une entreprise. Chaque entreprise a le sien, séparé de celui des autres. "
                .'Il est composé de modules (actualités, annonces, documents, calendrier, FAQ, formulaires, annuaire…) que l\'entreprise active selon ses besoins. '
                ."Chaque personne a un rôle (Administrateur, RH, Manager, Employé ou rôle personnalisé) qui détermine ce qu'elle voit et ce qu'elle peut faire. "
                .'Après connexion, le menu de gauche donne accès au tableau de bord, à l\'accueil et aux modules autorisés pour le rôle. '
                .'Le site visiteur présente le produit et permet de créer l\'intranet d\'une entreprise.',
        ],
        'roles' => [
            'mots' => ['role', 'permission', 'droit', 'acces', 'administrateur', 'manager', 'rh', 'employe', 'super administrateur', 'superadmin', 'qui peut'],
            'titre' => 'Rôles et permissions',
            'texte' => "Administrateur : gère toute l'entreprise (utilisateurs, départements, rôles, contenus, configuration). "
                .'RH : gère les utilisateurs et les départements dans la limite de ses droits ; il ne peut pas attribuer ni modifier le rôle Administrateur. '
                .'Manager : publie et gère des contenus uniquement pour son département. '
                .'Employé : consulte les contenus, l\'annuaire, le calendrier, les documents et la FAQ, et remplit les formulaires. '
                .'Un rôle ne peut être attribué que par quelqu\'un qui possède lui-même toutes les permissions de ce rôle. '
                .'Le Super-administrateur est l\'opérateur de la plateforme : il gère les intranets des entreprises et le catalogue de modules, pas le contenu des entreprises. '
                .'Le menu « Rôles et permissions » permet de créer des rôles personnalisés.',
        ],
        'modules' => [
            'mots' => ['module', 'activer', 'desactiver', 'fonctionnalite', 'catalogue'],
            'titre' => 'Modules',
            'texte' => 'Les modules sont les fonctionnalités de l\'intranet : Actualités, Annonces, Articles, Notes de service, Pages internes, Documents, Événements et Calendrier, FAQ, Formulaires, Annuaire, Utilisateurs, Rôles. '
                .'Un module désactivé disparaît du menu et ses actions sont bloquées pour tout le monde. '
                .'Un administrateur les active ou les désactive dans Configuration > Modules.',
        ],
        'actualites' => [
            'mots' => ['actualite', 'annonce', 'article', 'publier', 'contenu'],
            'titre' => 'Actualités, annonces et articles',
            'texte' => 'Une actualité informe toute l\'entreprise ou un département. Une annonce peut avoir une date d\'expiration. Un article est un contenu plus long. '
                .'Chaque contenu a un statut : brouillon, publié ou archivé. Publier un contenu notifie ses destinataires ; archiver le retire de l\'intranet. '
                .'Le destinataire est toute l\'entreprise ou un département précis. Un Manager ne peut publier que pour son département. '
                .'Où : menu Contenus > Actualités, Annonces ou Articles (selon les modules activés et vos droits).',
        ],
        'notes' => [
            'mots' => ['note de service', 'notes de service', 'note', 'lecture', 'accuse'],
            'titre' => 'Notes de service',
            'texte' => 'Une note de service est un contenu officiel avec un numéro. Les destinataires doivent confirmer qu\'ils l\'ont lue ; la confirmation de lecture est enregistrée. '
                .'Où : menu Contenus > Notes de service.',
        ],
        'pages' => [
            'mots' => ['page', 'pages internes', 'emplacement'],
            'titre' => 'Pages internes',
            'texte' => 'Les pages internes sont des pages de texte permanentes (charte, procédures…). Elles ont un statut (brouillon, publié, archivé), des destinataires et un emplacement dans le menu. '
                .'Où : menu Contenus > Pages internes pour les gérer, « Pages internes » dans Mon entreprise pour les lire.',
        ],
        'documents' => [
            'mots' => ['document', 'fichier', 'telecharg', 'categorie'],
            'titre' => 'Documents',
            'texte' => 'Le module Documents partage des fichiers de l\'entreprise, classés par catégorie, pour toute l\'entreprise ou un département. '
                .'Les employés les consultent et les téléchargent ; les personnes autorisées en ajoutent et en modifient les informations. '
                .'Où : menu Contenus > Documents (gestion) ou Mon entreprise > Documents (consultation).',
        ],
        'evenements' => [
            'mots' => ['evenement', 'calendrier', 'agenda', 'reunion', 'date'],
            'titre' => 'Événements et calendrier',
            'texte' => 'Un événement a un titre, une date et une heure de début et de fin, un lieu, une description et des destinataires (toute l\'entreprise ou un département). '
                .'Les événements apparaissent dans le calendrier et notifient les destinataires. '
                .'Où : menu Contenus > Événements (gestion) ou Mon entreprise > Calendrier (consultation).',
        ],
        'faq' => [
            'mots' => ['faq', 'question frequente', 'questions frequentes'],
            'titre' => 'FAQ',
            'texte' => 'La FAQ rassemble des questions et leurs réponses, classées par catégorie. Tout le monde la consulte ; les personnes autorisées l\'alimentent. '
                .'Où : menu Contenus > FAQ (gestion) ou Mon entreprise > FAQ (consultation).',
        ],
        'formulaires' => [
            'mots' => ['formulaire', 'sondage', 'enquete', 'reponse', 'cloture'],
            'titre' => 'Formulaires',
            'texte' => 'Un formulaire est créé en brouillon, puis publié pour être rempli, puis clôturé (il n\'accepte alors plus de réponses). Il peut avoir une date limite. '
                .'Les employés remplissent les formulaires publiés dans « Mes formulaires ». '
                .'Où : menu Contenus > Formulaires (gestion).',
        ],
        'annuaire' => [
            'mots' => ['annuaire', 'organigramme', 'collegue', 'contact', 'telephone', 'poste'],
            'titre' => 'Annuaire et organigramme',
            'texte' => 'L\'annuaire liste les collègues de l\'entreprise (nom, poste, département, contact) avec une recherche. '
                .'L\'organigramme montre la hiérarchie, d\'après le supérieur hiérarchique indiqué sur chaque compte. '
                .'Où : menu Mon entreprise > Annuaire et Organigramme.',
        ],
        'utilisateurs' => [
            'mots' => ['utilisateur', 'compte', 'mot de passe', 'desactiv', 'reactiv', 'inactif', 'creer un compte', 'supprimer'],
            'titre' => 'Comptes utilisateurs',
            'texte' => 'Les comptes sont créés par un administrateur ou un RH, avec un rôle et éventuellement un département et un supérieur hiérarchique. '
                .'Le mot de passe temporaire est généré automatiquement et affiché une seule fois à la personne qui crée le compte. '
                .'Un compte désactivé est déconnecté immédiatement et ne peut plus se connecter ; il peut être réactivé. Les comptes ne sont pas supprimés. '
                .'Le dernier administrateur actif ne peut pas être désactivé ni changer de rôle. Changer l\'adresse e-mail d\'un compte ferme ses sessions. '
                .'Où : menu Organisation > Utilisateurs.',
        ],
        'departements' => [
            'mots' => ['departement', 'service', 'equipe', 'responsable', 'parent'],
            'titre' => 'Départements',
            'texte' => 'Les départements structurent l\'entreprise. Un département peut avoir un département parent et un responsable. '
                .'Ils servent à cibler les contenus (seuls les membres du département les reçoivent) et à limiter les Managers. '
                .'Où : menu Organisation > Départements.',
        ],
        'notifications' => [
            'mots' => ['notification', 'cloche', 'alerte', 'prevenu'],
            'titre' => 'Notifications',
            'texte' => 'La cloche en haut de l\'écran affiche les notifications : nouvelle actualité, événement, note de service, etc. '
                .'Chaque notification indique qui a agi, ce qui a été publié et l\'heure. Si une publication cible un département, les autres départements ne reçoivent rien.',
        ],
        'personnalisation' => [
            'mots' => ['apparence', 'menu', 'couleur', 'logo', 'parametre', 'personnalis', 'theme', 'configuration'],
            'titre' => 'Configuration',
            'texte' => 'Le menu Configuration regroupe : Modules (activer ou désactiver les fonctionnalités), Apparence (personnaliser l\'aspect de l\'intranet de l\'entreprise), '
                .'Menus (renommer des entrées, les masquer, ajouter des liens) et Paramètres. Ces pages sont réservées aux personnes autorisées, en général l\'administrateur.',
        ],
        'assistant' => [
            'mots' => ['assistant', 'ia', 'robot', 'que peux', 'que sais', 'que fais', 'aide', 'help', 'capacite'],
            'titre' => "L'assistant",
            'texte' => 'L\'assistant prépare des actions à partir d\'une demande en français ou d\'un formulaire, puis attend votre confirmation : rien n\'est exécuté sans votre accord. '
                .'Il agit dans la limite de votre rôle, des modules activés et de votre département. '
                .'Il peut : créer et modifier des comptes, les activer ou désactiver, réinitialiser un mot de passe ; créer et modifier des départements ; '
                .'publier, modifier, publier ou archiver des actualités, annonces, articles et notes de service ; créer et modifier des événements, des questions de la FAQ et des pages ; '
                .'modifier les informations d\'un document ; publier ou clôturer un formulaire. Il peut aussi lister les comptes, départements, contenus, événements, documents et formulaires. '
                .'Il ne supprime jamais rien, n\'ajoute pas de fichier et ne gère ni les rôles, ni les modules, ni l\'apparence. '
                .'Les boutons de suggestion ouvrent directement le bon formulaire.',
        ],
    ];

    /** La question est-elle une demande d'explication sur l'intranet ? */
    public function estQuestionDAide(string $texte): bool
    {
        $t = $this->normaliser($texte);
        foreach (self::MOTIFS as $motif) {
            if (preg_match($motif, $t) === 1) {
                return true;
            }
        }

        return false;
    }

    /** Informations à joindre au modèle, adaptées au rôle ; null si ce n'est pas une question d'aide. */
    public function contexte(Utilisateur $utilisateur, string $question): ?string
    {
        if (! $this->estQuestionDAide($question)) {
            return null;
        }

        $t = $this->normaliser($question);
        $scores = [];
        foreach (self::SUJETS as $cle => $sujet) {
            $score = 0;
            foreach ($sujet['mots'] as $mot) {
                $motif = strlen($mot) <= 3 ? '/\b'.preg_quote($mot, '/').'\b/' : '/\b'.preg_quote($mot, '/').'/';
                if (preg_match($motif, $t) === 1) {
                    $score++;
                }
            }
            if ($score > 0) {
                $scores[$cle] = $score;
            }
        }
        arsort($scores);
        $retenus = array_slice(array_keys($scores), 0, 3);
        if ($retenus === []) {
            $retenus = ['general', 'roles'];
        }

        $blocs = array_map(fn ($cle) => '- '.self::SUJETS[$cle]['titre'].' : '.self::SUJETS[$cle]['texte'], $retenus);

        return "MODE AIDE : réponds en français, simplement, en quelques lignes, uniquement à partir des informations ci-dessous. "
            ."Si la réponse n'y figure pas, dis que tu ne sais pas et conseille de contacter l'administrateur de l'entreprise. N'invente aucune fonctionnalité. "
            ."N'appelle aucun outil dans ce mode.\n"
            .$this->profil($utilisateur)."\n\nInformations :\n".implode("\n", $blocs);
    }

    private function profil(Utilisateur $utilisateur): string
    {
        $utilisateur->loadMissing('role');
        $codes = $utilisateur->role?->permissions()->pluck('code_permission')->all() ?? [];

        $gerer = array_values(array_filter(self::ACCES_GERER, fn ($code) => in_array($code, $codes, true), ARRAY_FILTER_USE_KEY));
        $consulter = array_values(array_filter(self::ACCES_CONSULTER, fn ($code) => in_array($code, $codes, true), ARRAY_FILTER_USE_KEY));

        $actifs = DB::table('modules_entreprise')
            ->join('modules', 'modules.id', '=', 'modules_entreprise.module_id')
            ->where('modules_entreprise.entreprise_id', $utilisateur->entreprise_id)
            ->where('modules_entreprise.module_actif', true)
            ->pluck('modules.code_module')
            ->map(fn ($code) => self::MODULES[$code] ?? $code)
            ->all();

        return 'La personne qui pose la question a le rôle « '.($utilisateur->role?->nom_role ?? 'inconnu').' ». '
            .'Elle peut gérer : '.($gerer ? implode(', ', $gerer) : 'rien').'. '
            .'Elle peut consulter : '.($consulter ? implode(', ', $consulter) : 'rien de particulier').'. '
            .'Modules activés dans son intranet : '.($actifs ? implode(', ', $actifs) : 'aucun').'. '
            .'Adapte ta réponse à ces droits et ne présente pas comme possible ce qui est hors de son rôle.';
    }

    private function normaliser(string $texte): string
    {
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', Str::lower(Str::ascii($texte))));
    }
}

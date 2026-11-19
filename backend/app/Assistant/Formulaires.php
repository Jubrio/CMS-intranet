<?php

namespace App\Assistant;

use App\Assistant\Tools\ToolException;
use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Document;
use App\Models\Evenement;
use App\Models\Formulaire;
use App\Models\QuestionFaq;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use App\Services\DroitsUtilisateurs;
use Illuminate\Support\Str;

/**
 * Formulaires de l'assistant : le modèle choisit l'action et pré-remplit ce qu'il a compris, la personne vérifie et
 * complète avec des listes (départements, rôles, comptes, contenus existants). Le modèle n'a plus à deviner
 * d'adresse e-mail, d'identifiant ou de nom exact. Les champs sont déduits du schéma de chaque outil.
 */
class Formulaires
{
    private const LIBELLES_OUTILS = [
        'creer_utilisateur' => 'Créer un compte',
        'modifier_utilisateur' => 'Modifier un compte',
        'changer_statut_utilisateur' => 'Activer ou désactiver un compte',
        'reinitialiser_mot_de_passe' => 'Réinitialiser un mot de passe',
        'creer_departement' => 'Créer un département',
        'modifier_departement' => 'Modifier un département',
        'publier_contenu' => 'Publier un contenu',
        'modifier_contenu' => 'Modifier un contenu',
        'changer_statut_contenu' => 'Publier ou archiver un contenu',
        'creer_evenement' => 'Créer un événement',
        'modifier_evenement' => 'Modifier un événement',
        'creer_question_faq' => 'Ajouter une question à la FAQ',
        'modifier_question_faq' => 'Modifier une question de la FAQ',
        'creer_page' => 'Créer une page',
        'modifier_page' => 'Modifier une page',
        'changer_statut_page' => 'Publier ou archiver une page',
        'modifier_document' => 'Modifier un document',
        'changer_statut_formulaire' => 'Publier ou clôturer un formulaire',
    ];

    private const LIBELLES_CHAMPS = [
        'nom' => 'Nom', 'prenom' => 'Prénom', 'email' => 'Compte concerné', 'role' => 'Rôle',
        'departement' => 'Département destinataire', 'parent' => 'Département parent', 'responsable' => 'Responsable',
        'superieur' => 'Supérieur hiérarchique', 'poste' => 'Poste', 'telephone' => 'Téléphone',
        'nouveau_nom' => 'Nouveau nom', 'nouveau_prenom' => 'Nouveau prénom', 'nouvel_email' => 'Nouvelle adresse e-mail',
        'actif' => 'Statut du compte', 'type' => 'Type de contenu', 'id' => 'Élément concerné', 'action' => 'Action',
        'titre' => 'Titre', 'corps' => 'Texte', 'categorie' => 'Catégorie', 'description' => 'Description',
        'date_expiration' => "Date d'expiration", 'numero_note' => 'Numéro de la note', 'brouillon' => 'Enregistrer en brouillon (sans publier)',
        'date_debut' => 'Début', 'date_fin' => 'Fin', 'lieu' => 'Lieu', 'question' => 'Question', 'reponse' => 'Réponse',
        'emplacement_menu' => 'Emplacement dans le menu', 'publier' => 'Publier tout de suite', 'nom_document' => 'Nom du document',
    ];

    private const LIBELLES_VALEURS = [
        'actualite' => 'Actualité', 'annonce' => 'Annonce', 'article' => 'Article', 'note_service' => 'Note de service',
        'publier' => 'Publier', 'archiver' => 'Archiver', 'cloturer' => 'Clôturer',
    ];

    private const TYPES_CONTENU = ['actualite', 'annonce', 'article', 'note_service'];

    /** Champs que le modèle ne doit jamais inventer : sa valeur n'est gardée que si la personne l'a écrite. */
    private const A_CONFIRMER_PAR_LE_MESSAGE = [
        'nom', 'prenom', 'email', 'nouvel_email', 'nouveau_nom', 'nouveau_prenom', 'telephone', 'poste', 'role', 'departement', 'superieur', 'responsable',
    ];

    public function __construct(
        private ToolRegistry $outils,
        private AccesContenus $acces,
        private DroitsUtilisateurs $droits,
    ) {}

    /** @return list<array{outil: string, libelle: string}> */
    public function catalogue(Utilisateur $utilisateur): array
    {
        $liste = [];
        foreach ($this->outils->schemasPour($utilisateur) as $schema) {
            $nom = $schema['function']['name'];
            $outil = $this->outils->trouver($nom);
            if ($outil && $outil->requiresConfirmation()) {
                $liste[] = ['outil' => $nom, 'libelle' => self::LIBELLES_OUTILS[$nom] ?? $nom];
            }
        }

        return $liste;
    }

    /**
     * Formulaire d'un outil, avec les valeurs que le modèle a comprises (seulement celles qui existent vraiment).
     *
     * @return array{outil: string, titre: string, aide: string|null, champs: list<array>, valeurs: array}
     */
    public function construire(Utilisateur $utilisateur, string $nom, array $prefill = [], ?string $dit = null): array
    {
        $outil = $this->outils->trouver($nom);
        if (! $outil || ! $outil->requiresConfirmation() || ! $outil->authorize($utilisateur)) {
            throw new ToolException("Ce formulaire n'est pas disponible pour votre rôle.");
        }

        $parametres = $outil->schema()['function']['parameters'];
        $requis = $parametres['required'] ?? [];
        $champs = [];

        foreach ($parametres['properties'] ?? [] as $cle => $definition) {
            if ($cle === 'id') {
                continue; // remplacé par la liste des éléments, à la place de « titre_actuel »
            }
            $champs[] = $cle === 'titre_actuel'
                ? $this->champElement($utilisateur, $nom)
                : $this->champ($utilisateur, $nom, $cle, $definition, in_array($cle, $requis, true));
        }

        $modification = str_starts_with($nom, 'modifier_');

        return [
            'outil' => $nom,
            'titre' => self::LIBELLES_OUTILS[$nom] ?? $nom,
            'aide' => $modification ? 'Ne remplissez que ce que vous voulez changer.' : null,
            'champs' => $champs,
            'valeurs' => $this->preremplir($champs, $prefill, $dit),
        ];
    }

    /** Un tableau vide doit rester un objet JSON {} (et non []) pour le panneau. */
    public static function enJson(array $formulaire): array
    {
        if ($formulaire['valeurs'] === []) {
            $formulaire['valeurs'] = new \stdClass;
        }

        return $formulaire;
    }

    /** Paramètres de l'outil à partir des valeurs saisies dans le formulaire (jamais de clé inconnue). */
    public function parametres(Utilisateur $utilisateur, string $nom, array $valeurs): array
    {
        $outil = $this->outils->trouver($nom);
        if (! $outil || ! $outil->requiresConfirmation() || ! $outil->authorize($utilisateur)) {
            throw new ToolException("Ce formulaire n'est pas disponible pour votre rôle.");
        }

        $parametres = [];
        foreach ($outil->schema()['function']['parameters']['properties'] ?? [] as $cle => $definition) {
            if ($cle === 'titre_actuel' || ! array_key_exists($cle, $valeurs)) {
                continue;
            }
            $v = $valeurs[$cle];
            if ($v === null || $v === '' || $v === [] || (! is_scalar($v))) {
                continue;
            }
            if (($definition['type'] ?? '') === 'boolean') {
                $v = filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($v === null) {
                    continue;
                }
            } elseif (($definition['type'] ?? '') === 'integer') {
                $v = (int) $v;
            } else {
                $v = trim((string) $v);
                if (in_array($cle, ['date_debut', 'date_fin'], true)) {
                    $v = str_replace('T', ' ', $v);
                }
                if ($v === '') {
                    continue;
                }
            }
            $parametres[$cle] = $v;
        }

        return $parametres;
    }

    // ---- champs --------------------------------------------------------------------------------------------------

    private function champ(Utilisateur $u, string $outil, string $cle, array $definition, bool $requis): array
    {
        $modification = str_starts_with($outil, 'modifier_') || str_starts_with($outil, 'changer_');
        $champ = [
            'nom' => $cle,
            'libelle' => self::LIBELLES_CHAMPS[$cle] ?? Str::ucfirst(str_replace('_', ' ', $cle)),
            'type' => 'texte',
            'requis' => $requis,
        ];

        if (in_array($cle, ['corps', 'description', 'reponse'], true)) {
            $champ['type'] = 'zone';
        }
        if (in_array($cle, ['date_debut', 'date_fin'], true)) {
            $champ['type'] = 'date_heure';
        }
        if ($cle === 'date_expiration') {
            $champ['type'] = 'date';
        }
        if (($definition['type'] ?? '') === 'boolean') {
            $champ['type'] = 'oui_non';
        }

        if ($cle === 'actif') {
            return array_merge($champ, ['type' => 'choix', 'requis' => true, 'options' => [
                ['valeur' => 'false', 'libelle' => 'Désactiver le compte'],
                ['valeur' => 'true', 'libelle' => 'Réactiver le compte'],
            ]]);
        }

        if (isset($definition['enum'])) {
            $champ['type'] = 'choix';
            $champ['options'] = array_map(
                fn ($v) => ['valeur' => $v, 'libelle' => self::LIBELLES_VALEURS[$v] ?? Str::ucfirst($v)],
                $definition['enum'],
            );

            return $champ;
        }

        if ($cle === 'email' && $outil === 'creer_utilisateur') {
            $champ['libelle'] = 'Adresse e-mail professionnelle';
        }

        $options = null;
        $vide = $modification ? 'Ne pas changer' : 'Aucun';

        if ($cle === 'departement' && $outil === 'modifier_departement') {
            $options = $this->departements($u, false);
            $champ['requis'] = true;
            $vide = null;
        } elseif ($cle === 'departement' || $cle === 'parent') {
            $options = $this->departements($u, true);
            if ($cle === 'departement' && ! $this->acces->peutCibler($u, 'entreprise', null)) {
                $champ['requis'] = true; // un Manager cible toujours son département
                $vide = null;
            } else {
                $vide = $modification ? 'Ne pas changer' : ($cle === 'parent' ? 'Aucun parent' : "Toute l'entreprise");
                if ($modification) {
                    $options[] = ['valeur' => 'aucun', 'libelle' => $cle === 'parent' ? 'Aucun parent' : "Toute l'entreprise"];
                }
            }
        } elseif ($cle === 'role') {
            $options = $this->roles($u);
        } elseif ($cle === 'email' && $outil !== 'creer_utilisateur') {
            $options = $this->comptes($u, true);
            $champ['requis'] = true;
            $vide = null;
        } elseif (in_array($cle, ['superieur', 'responsable'], true)) {
            $options = $this->comptes($u, false);
            if ($modification) {
                $options[] = ['valeur' => 'aucun', 'libelle' => 'Aucun'];
            }
        }

        if ($options !== null) {
            $champ['type'] = 'choix';
            $champ['options'] = $options;
            if ($vide !== null) {
                $champ['vide'] = $vide;
            }
        }

        return $champ;
    }

    /** Liste de l'élément à modifier ou changer de statut (remplace l'identifiant que le modèle devait deviner). */
    private function champElement(Utilisateur $u, string $outil): array
    {
        $champ = ['nom' => 'id', 'libelle' => self::LIBELLES_CHAMPS['id'], 'type' => 'choix', 'requis' => true, 'options' => $this->elements($u, $outil)];
        if (in_array($outil, ['modifier_contenu', 'changer_statut_contenu'], true)) {
            $champ['si'] = ['champ' => 'type']; // la liste se filtre selon le type choisi
        }

        return $champ;
    }

    private function departements(Utilisateur $u, bool $filtrer): array
    {
        return Departement::where('entreprise_id', $u->entreprise_id)->orderBy('nom_departement')->get()
            ->filter(fn ($d) => ! $filtrer || $this->acces->peutCibler($u, 'departement', $d->id))
            ->map(fn ($d) => ['valeur' => $d->nom_departement, 'libelle' => $d->nom_departement])
            ->values()->all();
    }

    private function roles(Utilisateur $u): array
    {
        return Role::where('entreprise_id', $u->entreprise_id)->orderBy('nom_role')->get()
            ->filter(fn ($r) => $this->droits->roleAttribuable($u, $r))
            ->map(fn ($r) => ['valeur' => $r->nom_role, 'libelle' => $r->nom_role])
            ->values()->all();
    }

    private function comptes(Utilisateur $u, bool $gerables): array
    {
        return Utilisateur::with('role')->where('entreprise_id', $u->entreprise_id)->orderBy('nom')->orderBy('prenom')->get()
            ->filter(fn ($c) => ! $gerables || $this->droits->peutGerer($u, $c))
            ->map(fn ($c) => ['valeur' => $c->email, 'libelle' => trim($c->prenom.' '.$c->nom).' — '.$c->email, 'titre' => trim($c->prenom.' '.$c->nom)])
            ->values()->all();
    }

    /** Éléments existants visibles pour l'utilisateur, selon l'outil. */
    private function elements(Utilisateur $u, string $outil): array
    {
        $pas = fn ($e) => $this->acces->peutCibler($u, (string) ($e->visibilite ?? 'entreprise'), $e->departement_id ?? null);
        $entreprise = $u->entreprise_id;

        switch ($outil) {
            case 'modifier_contenu':
            case 'changer_statut_contenu':
                return Contenu::where('entreprise_id', $entreprise)->whereIn('type_contenu', self::TYPES_CONTENU)->orderByDesc('id')->limit(200)->get()
                    ->filter($pas)
                    ->map(fn ($c) => ['valeur' => $c->id, 'libelle' => "{$c->titre} ({$c->statut_contenu})", 'titre' => $c->titre, 'type' => $c->type_contenu])
                    ->values()->all();
            case 'modifier_page':
            case 'changer_statut_page':
                return Contenu::where('entreprise_id', $entreprise)->where('type_contenu', 'page')->orderByDesc('id')->limit(200)->get()
                    ->filter($pas)
                    ->map(fn ($c) => ['valeur' => $c->id, 'libelle' => "{$c->titre} ({$c->statut_contenu})", 'titre' => $c->titre])
                    ->values()->all();
            case 'modifier_evenement':
                return Evenement::where('entreprise_id', $entreprise)->orderByDesc('date_debut')->limit(200)->get()
                    ->filter($pas)
                    ->map(fn ($e) => ['valeur' => $e->id, 'libelle' => $e->titre_evenement.' ('.$e->date_debut?->format('d/m/Y').')', 'titre' => $e->titre_evenement])
                    ->values()->all();
            case 'modifier_question_faq':
                return QuestionFaq::where('entreprise_id', $entreprise)->orderBy('categorie')->orderBy('question')->limit(200)->get()
                    ->map(fn ($q) => ['valeur' => $q->id, 'libelle' => $q->question, 'titre' => $q->question])
                    ->values()->all();
            case 'modifier_document':
                return Document::where('entreprise_id', $entreprise)->orderByDesc('id')->limit(200)->get()
                    ->filter($pas)
                    ->map(fn ($d) => ['valeur' => $d->id, 'libelle' => $d->nom_document, 'titre' => $d->nom_document])
                    ->values()->all();
            case 'changer_statut_formulaire':
                return Formulaire::where('entreprise_id', $entreprise)->orderByDesc('id')->limit(200)->get()
                    ->filter($pas)
                    ->map(fn ($f) => ['valeur' => $f->id, 'libelle' => "{$f->titre_formulaire} ({$f->statut_formulaire})", 'titre' => $f->titre_formulaire])
                    ->values()->all();
        }

        return [];
    }

    // ---- pré-remplissage -----------------------------------------------------------------------------------------

    private function preremplir(array $champs, array $prefill, ?string $dit): array
    {
        $valeurs = [];
        foreach ($champs as $champ) {
            $cle = $champ['nom'];
            $v = $prefill[$cle] ?? null;
            if ($cle === 'id' && ($v === null || $v === '')) {
                $v = $prefill['titre_actuel'] ?? null; // le modèle donne le titre : on retrouve l'élément dans la liste
            }
            if ($dit !== null && in_array($cle, self::A_CONFIRMER_PAR_LE_MESSAGE, true) && is_scalar($v) && ! $this->ditDansLeMessage((string) $v, $dit)) {
                continue; // valeur que la personne n'a jamais écrite : le modèle l'a inventée
            }
            if (is_bool($v)) {
                $v = $v ? 'true' : 'false';
            }
            if ($v === null || $v === '' || ! (is_scalar($v))) {
                continue;
            }

            if (isset($champ['options'])) {
                $trouve = $this->retrouverOption($champ['options'], (string) $v, $cle === 'id' || $cle === 'email' || in_array($cle, ['superieur', 'responsable'], true), $prefill['type'] ?? null, isset($champ['si']));
                if ($trouve !== null) {
                    $valeurs[$cle] = $trouve;
                }
            } elseif ($champ['type'] === 'oui_non') {
                $b = filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($b !== null) {
                    $valeurs[$cle] = $b;
                }
            } else {
                $valeurs[$cle] = trim((string) $v);
            }
        }

        return $valeurs;
    }

    private function ditDansLeMessage(string $valeur, string $dit): bool
    {
        $n = fn (string $t) => trim((string) preg_replace('/[^a-z0-9]+/', ' ', Str::lower(Str::ascii($t))));
        $cle = $n($valeur);

        return $cle !== '' && str_contains(' '.$n($dit).' ', ' '.$cle.' ');
    }

    /** Une valeur du modèle n'est gardée que si elle correspond à une option réelle (jamais une valeur inventée). */
    private function retrouverOption(array $options, string $v, bool $parTitre, ?string $type, bool $filtrerParType): mixed
    {
        $n = fn (string $t) => Str::lower(Str::ascii(trim($t)));
        $cle = $n($v);
        if ($cle === '') {
            return null;
        }
        if ($filtrerParType && $type) {
            $options = array_values(array_filter($options, fn ($o) => ($o['type'] ?? null) === $type));
        }

        foreach ($options as $o) {
            if ($n((string) $o['valeur']) === $cle) {
                return $o['valeur'];
            }
        }
        foreach ($options as $o) {
            if ($n($o['libelle']) === $cle || (isset($o['titre']) && $n($o['titre']) === $cle)) {
                return $o['valeur'];
            }
        }
        if ($parTitre) {
            $partiels = array_values(array_filter($options, fn ($o) => isset($o['titre']) && $n($o['titre']) !== ''
                && (str_contains($n($o['titre']), $cle) || str_contains($cle, $n($o['titre'])))));
            if (count($partiels) === 1) {
                return $partiels[0]['valeur'];
            }
        }

        return null;
    }
}

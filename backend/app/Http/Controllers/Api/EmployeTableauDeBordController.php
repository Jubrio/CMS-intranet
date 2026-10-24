<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contenu;
use App\Models\Departement;
use App\Models\Document;
use App\Models\Evenement;
use App\Models\Formulaire;
use App\Models\LectureNote;
use App\Models\Reponse;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use App\Services\AnniversairesEmbauche;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Tableau de bord de l'Employé : ce qui le concerne au quotidien (notes à lire, nouveautés,
// événements, formulaires à remplir, documents) et son entourage (département, supérieur, collègues).
// Lecture seule. Chaque bloc suit les mêmes règles de visibilité que les écrans correspondants
// (entreprise, département ou auteur : RG05, RG22) et vaut `null` si le module est désactivé
// ou si le rôle n'a pas le droit de consultation : l'écran masque alors le bloc.
class EmployeTableauDeBordController extends Controller
{
    private const TYPES = [
        'actualite' => 'Actualités',
        'annonce' => 'Annonces',
        'article' => 'Articles',
        'note_service' => 'Notes de service',
    ];

    private const LIMITE_FIL = 8;

    private const LIMITE_LISTES = 5;

    private const LIMITE_COLLEGUES = 8;

    private const HORIZON_JOURS = 30;

    private const NOUVEAU_JOURS = 7;

    private const NOTES_JOURS = 90;

    public function __invoke(Request $request, AccesContenus $acces, AnniversairesEmbauche $anniversaires): JsonResponse
    {
        $u = $request->user()->loadMissing('role.permissions');
        abort_unless($u->entreprise_id, 403, "Réservé aux comptes d'une entreprise.");

        $modules = DB::table('modules_entreprise')
            ->join('modules', 'modules.id', '=', 'modules_entreprise.module_id')
            ->where('modules_entreprise.entreprise_id', $u->entreprise_id)
            ->where('modules_entreprise.module_actif', true)
            ->pluck('modules.code_module')->all();
        $droits = $u->role->permissions->pluck('code_permission')->all();
        // Vrai si tous les modules sont actifs et toutes les permissions accordées
        $peut = fn (array $mods, array $perms) => array_diff($mods, $modules) === [] && array_diff($perms, $droits) === [];

        $aujourdhui = now()->startOfDay();

        // Comptes actifs de l'entreprise, lus une fois (colonnes utiles seulement)
        $actifs = Utilisateur::where('entreprise_id', $u->entreprise_id)
            ->where('statut_compte', 'actif')
            ->get(['id', 'nom', 'prenom', 'poste', 'photo', 'date_embauche', 'departement_id', 'superieur_id']);

        return response()->json([
            'genere_le' => now()->toIso8601String(),
            'profil' => $this->profil($u, $aujourdhui),
            'equipe' => $this->equipe($u, $actifs, $aujourdhui, $anniversaires, $peut(['annuaire'], ['annuaire.consulter'])),
            'contenus' => $this->contenus($u, $acces, $aujourdhui),
            'evenements' => $peut(['calendrier', 'evenements'], ['calendrier.consulter', 'evenements.consulter'])
                ? $this->evenements($u) : null,
            'formulaires' => $peut(['formulaires'], ['formulaires.repondre'])
                ? $this->formulaires($u) : null,
            'documents' => $peut(['documents'], ['documents.consulter'])
                ? $this->documents($u) : null,
        ]);
    }

    // Ancienneté et fiche personnelle : ce que l'employé peut compléter lui-même (profil)
    private function profil(Utilisateur $u, Carbon $aujourdhui): array
    {
        $manque = [];
        foreach (['poste' => 'poste', 'telephone' => 'telephone', 'photo' => 'photo'] as $cle => $champ) {
            if (blank($u->{$champ})) {
                $manque[] = $cle;
            }
        }

        return [
            'date_embauche' => $u->date_embauche?->toDateString(),
            'anciennete_mois' => $u->date_embauche
                ? max(0, (int) floor($u->date_embauche->diffInMonths($aujourdhui, false)))
                : null,
            'fiche_manque' => $manque,
        ];
    }

    private function equipe(Utilisateur $u, Collection $actifs, Carbon $aujourdhui, AnniversairesEmbauche $anniversaires, bool $voirAnnuaire): array
    {
        $departement = null;
        if ($u->departement_id) {
            $d = Departement::with('responsable:id,nom,prenom,poste')
                ->where('entreprise_id', $u->entreprise_id)
                ->find($u->departement_id);
            if ($d) {
                $departement = [
                    'id' => $d->id,
                    'nom_departement' => $d->nom_departement,
                    'description' => $d->description_departement,
                    'nb_employes' => $actifs->where('departement_id', $d->id)->count(),
                    'responsable' => $d->responsable
                        ? $d->responsable->only(['id', 'nom', 'prenom', 'poste'])
                        : null,
                ];
            }
        }

        $superieur = $u->superieur_id ? $actifs->firstWhere('id', $u->superieur_id) : null;

        $collegues = $u->departement_id
            ? $actifs->where('departement_id', $u->departement_id)->where('id', '!=', $u->id)->sortBy('nom')->values()
            : collect();

        $limite30 = $aujourdhui->copy()->subDays(self::HORIZON_JOURS);
        $nouveaux = $voirAnnuaire
            ? $actifs->filter(fn ($m) => $m->id !== $u->id && $m->date_embauche !== null
                && $m->date_embauche->between($limite30, $aujourdhui))
                ->sortByDesc(fn ($m) => $m->date_embauche->timestamp)
                ->take(self::LIMITE_LISTES)
                ->map(fn ($m) => $this->personne($m) + ['date_embauche' => $m->date_embauche->toDateString()])
                ->values()->all()
            : [];

        return [
            'departement' => $departement,
            'superieur' => $superieur ? $this->personne($superieur) : null,
            'nb_collegues' => $collegues->count(),
            'collegues' => $collegues->take(self::LIMITE_COLLEGUES)->map(fn ($m) => $this->personne($m))->values()->all(),
            'anniversaires' => $anniversaires->prochains($collegues, $aujourdhui, self::HORIZON_JOURS, self::LIMITE_LISTES),
            'nouveaux' => $nouveaux,
        ];
    }

    private function personne(Utilisateur $m): array
    {
        return ['id' => $m->id, 'nom' => $m->nom, 'prenom' => $m->prenom, 'poste' => $m->poste, 'photo' => $m->photo];
    }

    // Fil des publications visibles par l'employé, nouveautés par type et notes de service à lire
    private function contenus(Utilisateur $u, AccesContenus $acces, Carbon $aujourdhui): array
    {
        $limiteNouveau = $aujourdhui->copy()->subDays(self::NOUVEAU_JOURS);
        $limiteNotes = $aujourdhui->copy()->subDays(self::NOTES_JOURS);

        $fil = collect();
        $types = [];

        foreach (self::TYPES as $type => $libelle) {
            if (! $acces->autorise($u, $type, 'consulter')) {
                continue; // module désactivé ou droit absent
            }

            $requete = $this->contenusVisibles($u, $type);
            $types[] = [
                'type' => $type,
                'libelle' => $libelle,
                'total' => (clone $requete)->count(),
                'nouveaux' => (clone $requete)->where('date_publication', '>=', $limiteNouveau)->count(),
            ];

            $lignes = (clone $requete)->with('auteur:id,nom,prenom')
                ->orderByDesc('date_publication')->orderByDesc('id')
                ->limit(self::LIMITE_FIL)
                ->get(['id', 'type_contenu', 'titre', 'corps', 'categorie', 'numero_note', 'date_publication', 'auteur_id']);

            foreach ($lignes as $c) {
                $fil->push([
                    'type' => $type,
                    'libelle_type' => $libelle,
                    'id' => $c->id,
                    'titre' => $c->titre,
                    'extrait' => Str::limit(trim(preg_replace('/\s+/', ' ', strip_tags((string) $c->corps))), 140),
                    'categorie' => $c->categorie,
                    'numero_note' => $c->numero_note,
                    'date_publication' => $c->date_publication?->toIso8601String(),
                    'auteur' => $c->auteur ? $c->auteur->only(['id', 'nom', 'prenom']) : null,
                    'nouveau' => $c->date_publication !== null && $c->date_publication->gte($limiteNouveau),
                ]);
            }
        }

        return [
            'types' => $types,
            'fil' => $fil->sortByDesc('date_publication')->take(self::LIMITE_FIL)->values()->all(),
            'notes' => $acces->autorise($u, 'note_service', 'consulter')
                ? $this->notes($u, $limiteNotes)
                : null,
        ];
    }

    // Notes de service des 90 derniers jours qui me concernent : lues, et celles qui restent à lire.
    // Les notes que j'ai écrites ne comptent pas : on ne se confirme pas sa propre lecture.
    private function notes(Utilisateur $u, Carbon $limite): array
    {
        $notes = $this->contenusVisibles($u, 'note_service')
            ->where('auteur_id', '!=', $u->id)
            ->where('date_publication', '>=', $limite);

        $lues = LectureNote::where('utilisateur_id', $u->id)->pluck('contenu_id');

        $total = (clone $notes)->count();
        $aLire = (clone $notes)->whereNotIn('id', $lues);
        $nbALire = (clone $aLire)->count();

        $liste = $aLire->with('auteur:id,nom,prenom')
            ->orderByDesc('date_publication')->orderByDesc('id')
            ->limit(self::LIMITE_LISTES)
            ->get(['id', 'titre', 'numero_note', 'date_publication', 'auteur_id']);

        return [
            'total' => $total,
            'lues' => $total - $nbALire,
            'a_lire' => $nbALire,
            'taux_lecture' => $total > 0 ? (int) round(($total - $nbALire) / $total * 100) : 100,
            'liste' => $liste->map(fn ($n) => [
                'id' => $n->id,
                'titre' => $n->titre,
                'numero_note' => $n->numero_note,
                'date_publication' => $n->date_publication?->toIso8601String(),
                'auteur' => $n->auteur ? $n->auteur->only(['id', 'nom', 'prenom']) : null,
            ])->values()->all(),
        ];
    }

    // Publiés, destinés à toute l'entreprise, à mon département ou écrits par moi (RG05, RG22)
    private function contenusVisibles(Utilisateur $u, string $type): Builder
    {
        $requete = Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', $type)
            ->where('statut_contenu', 'publie')
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            });

        if ($type === 'annonce') { // RG23 : une annonce n'est plus affichée après son expiration
            $requete->where(fn ($q) => $q->whereNull('date_expiration')
                ->orWhere('date_expiration', '>=', today()->toDateString()));
        }

        return $requete;
    }

    private function evenements(Utilisateur $u): array
    {
        $maintenant = now();
        $fin = $maintenant->copy()->addDays(self::HORIZON_JOURS)->endOfDay();

        $requete = Evenement::where('entreprise_id', $u->entreprise_id)
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            })
            ->where('date_fin', '>=', $maintenant)
            ->where('date_debut', '<=', $fin);

        $aujourdhui = (clone $requete)
            ->where('date_debut', '<=', $maintenant->copy()->endOfDay())
            ->count();

        $liste = (clone $requete)->orderBy('date_debut')->limit(self::LIMITE_LISTES + 1)->get();

        return [
            'total' => (clone $requete)->count(),
            'aujourdhui' => $aujourdhui,
            'a_venir' => $liste->map(fn ($e) => [
                'id' => $e->id,
                'titre_evenement' => $e->titre_evenement,
                'lieu' => $e->lieu,
                'date_debut' => $e->date_debut->format('Y-m-d H:i:s'),
                'date_fin' => $e->date_fin->format('Y-m-d H:i:s'),
            ])->values()->all(),
        ];
    }

    // Formulaires ouverts que je n'ai pas encore remplis
    private function formulaires(Utilisateur $u): array
    {
        $remplis = Reponse::where('utilisateur_id', $u->id)->pluck('formulaire_id');

        $requete = Formulaire::where('entreprise_id', $u->entreprise_id)
            ->where('statut_formulaire', 'publie')
            ->where(fn ($q) => $q->whereNull('date_limite')->orWhere('date_limite', '>=', today()->toDateString()))
            ->where(function ($w) use ($u) {
                $w->where('visibilite', 'entreprise');
                if ($u->departement_id) {
                    $w->orWhere(fn ($w2) => $w2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            })
            ->whereNotIn('id', $remplis);

        $liste = (clone $requete)
            // les plus urgents d'abord ; sans date limite en dernier
            ->orderByRaw('date_limite is null')->orderBy('date_limite')->orderByDesc('id')
            ->limit(self::LIMITE_LISTES)
            ->get(['id', 'titre_formulaire', 'date_limite']);

        return [
            'a_remplir' => (clone $requete)->count(),
            'liste' => $liste->map(fn ($f) => [
                'id' => $f->id,
                'titre_formulaire' => $f->titre_formulaire,
                'date_limite' => $f->date_limite?->toDateString(),
            ])->values()->all(),
        ];
    }

    private function documents(Utilisateur $u): array
    {
        $requete = Document::where('entreprise_id', $u->entreprise_id)
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            });

        $liste = (clone $requete)->orderByDesc('id')->limit(self::LIMITE_LISTES)
            ->get(['id', 'nom_document', 'categorie', 'type_mime', 'taille_fichier', 'created_at']);

        return [
            'total' => (clone $requete)->count(),
            'recents' => $liste->map(fn ($d) => [
                'id' => $d->id,
                'nom_document' => $d->nom_document,
                'categorie' => $d->categorie,
                'type_mime' => $d->type_mime,
                'taille_fichier' => $d->taille_fichier,
                'created_at' => $d->created_at?->toIso8601String(),
            ])->values()->all(),
        ];
    }
}

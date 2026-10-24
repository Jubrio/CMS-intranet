<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contenu;
use App\Models\Departement;
use App\Models\LectureNote;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use App\Services\AnniversairesEmbauche;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Tableau de bord du Manager : son équipe (supérieur → subordonnés), son département
// et ses publications. Un Manager ne publie que pour son département (RG21).
// Tout est limité à l'entreprise de l'appelant (RG05).
class ManagerTableauDeBordController extends Controller
{
    private const TYPES = [
        'actualite' => 'Actualités',
        'annonce' => 'Annonces',
        'article' => 'Articles',
        'note_service' => 'Notes de service',
    ];

    private const LIMITE_EQUIPE = 12;

    private const LIMITE_NOTES = 5;

    private const HORIZON_ANNIVERSAIRES_JOURS = 30;

    public function __invoke(Request $request, AccesContenus $acces, AnniversairesEmbauche $anniversaires): JsonResponse
    {
        $u = $request->user();
        abort_unless($u->entreprise_id && $acces->estManager($u), 403, 'Réservé au rôle Manager.');

        $aujourdhui = now()->startOfDay();

        // Comptes actifs de l'entreprise, lus une fois : la hiérarchie se parcourt en mémoire
        $actifs = Utilisateur::where('entreprise_id', $u->entreprise_id)
            ->where('statut_compte', 'actif')
            ->get(['id', 'nom', 'prenom', 'poste', 'telephone', 'date_embauche', 'departement_id', 'superieur_id']);

        $directs = $actifs->where('superieur_id', $u->id)->sortBy('nom')->values();
        $equipe = $this->equipe($actifs, $u->id);
        $limite30 = $aujourdhui->copy()->subDays(30);

        return response()->json([
            'genere_le' => now()->toIso8601String(),
            'peut_publier' => $u->departement_id !== null, // RG21
            'departement' => $this->departement($u, $actifs),
            'superieur' => $this->superieur($u, $actifs),
            'equipe' => [
                'nb_directs' => $directs->count(),
                'nb_total' => $equipe->count(),
                'arrivees_30j' => $equipe->filter(
                    fn ($m) => $m->date_embauche !== null && $m->date_embauche->between($limite30, $aujourdhui)
                )->count(),
                'fiches_incompletes' => $equipe->filter(
                    fn ($m) => blank($m->poste) || blank($m->telephone) || $m->departement_id === null
                )->count(),
                'directs' => $directs->take(self::LIMITE_EQUIPE)->map(fn ($m) => [
                    'id' => $m->id,
                    'nom' => $m->nom,
                    'prenom' => $m->prenom,
                    'poste' => $m->poste,
                    'date_embauche' => $m->date_embauche?->toDateString(),
                ])->values()->all(),
                'anniversaires' => $anniversaires->prochains($equipe, $aujourdhui, self::HORIZON_ANNIVERSAIRES_JOURS, 5),
            ],
            'contenus' => $this->contenus($u, $acces, $actifs, $aujourdhui),
        ]);
    }

    // Tous les subordonnés, directs ou non (parcours en largeur, protégé contre les boucles)
    private function equipe(Collection $actifs, int $racine): Collection
    {
        $enfants = $actifs->groupBy('superieur_id');
        $vus = [$racine => true];
        $file = [$racine];
        $ids = [];

        while ($file) {
            $courant = array_shift($file);
            foreach ($enfants->get($courant, []) as $enfant) {
                if (isset($vus[$enfant->id])) {
                    continue;
                }
                $vus[$enfant->id] = true;
                $ids[] = $enfant->id;
                $file[] = $enfant->id;
            }
        }

        return $actifs->whereIn('id', $ids)->values();
    }

    private function departement(Utilisateur $u, Collection $actifs): ?array
    {
        if (! $u->departement_id) {
            return null;
        }

        $d = Departement::with('responsable:id,nom,prenom')
            ->where('entreprise_id', $u->entreprise_id)
            ->find($u->departement_id);

        return $d ? [
            'id' => $d->id,
            'nom_departement' => $d->nom_departement,
            'nb_employes' => $actifs->where('departement_id', $d->id)->count(),
            'est_responsable' => $d->responsable_id === $u->id,
            'responsable' => $d->responsable
                ? ['id' => $d->responsable->id, 'nom' => $d->responsable->nom, 'prenom' => $d->responsable->prenom]
                : null,
        ] : null;
    }

    private function superieur(Utilisateur $u, Collection $actifs): ?array
    {
        $s = $u->superieur_id ? $actifs->firstWhere('id', $u->superieur_id) : null;

        return $s ? ['id' => $s->id, 'nom' => $s->nom, 'prenom' => $s->prenom, 'poste' => $s->poste] : null;
    }

    private function contenus(Utilisateur $u, AccesContenus $acces, Collection $actifs, Carbon $aujourdhui): array
    {
        $limite30 = $aujourdhui->copy()->subDays(30);
        $types = [];

        foreach (self::TYPES as $type => $libelle) {
            if (! $acces->autorise($u, $type, 'publier')) {
                continue; // module désactivé ou droit absent
            }
            $mes = Contenu::where('entreprise_id', $u->entreprise_id)
                ->where('type_contenu', $type)
                ->where('auteur_id', $u->id);

            $types[] = [
                'type' => $type,
                'libelle' => $libelle,
                'brouillons' => (clone $mes)->where('statut_contenu', 'brouillon')->count(),
                'publies' => (clone $mes)->where('statut_contenu', 'publie')->count(),
                'publies_30j' => (clone $mes)->where('statut_contenu', 'publie')
                    ->where('date_publication', '>=', $limite30)->count(),
            ];
        }

        $notes = $acces->autorise($u, 'note_service', 'publier') ? $this->notes($u, $actifs) : [];
        $taux = collect($notes)->pluck('taux');

        return [
            'types' => $types,
            'total_brouillons' => (int) collect($types)->sum('brouillons'),
            'notes' => $notes,
            'taux_lecture_moyen' => $taux->isEmpty() ? null : (int) round($taux->avg()),
        ];
    }

    // Dernières notes de service que le Manager suit : les siennes et celles de son département
    private function notes(Utilisateur $u, Collection $actifs): array
    {
        $notes = Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', 'note_service')
            ->where('statut_contenu', 'publie')
            ->where(function ($q) use ($u) {
                $q->where('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($d) => $d->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            })
            ->orderByDesc('date_publication')->orderByDesc('id')
            ->limit(self::LIMITE_NOTES)
            ->get(['id', 'titre', 'numero_note', 'visibilite', 'departement_id', 'date_publication']);

        if ($notes->isEmpty()) {
            return [];
        }

        $lectures = LectureNote::whereIn('contenu_id', $notes->pluck('id'))
            ->select('contenu_id', DB::raw('count(*) as n'))
            ->groupBy('contenu_id')
            ->pluck('n', 'contenu_id');

        $parDepartement = $actifs->countBy('departement_id');

        return $notes->map(function ($n) use ($lectures, $parDepartement, $actifs) {
            // Mêmes destinataires que le suivi des lectures : tous les actifs, ou ceux du département visé
            $destinataires = $n->visibilite === 'departement'
                ? (int) ($parDepartement[$n->departement_id] ?? 0)
                : $actifs->count();
            $nbLectures = (int) ($lectures[$n->id] ?? 0);

            return [
                'id' => $n->id,
                'titre' => $n->titre,
                'numero_note' => $n->numero_note,
                'visibilite' => $n->visibilite,
                'date_publication' => $n->date_publication?->toIso8601String(),
                'nb_destinataires' => $destinataires,
                'nb_lectures' => $nbLectures,
                'taux' => $destinataires > 0 ? min(100, (int) round($nbLectures / $destinataires * 100)) : 0,
            ];
        })->values()->all();
    }
}

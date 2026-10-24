<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departement;
use App\Models\Utilisateur;
use App\Services\AnniversairesEmbauche;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Tableau de bord des ressources humaines : effectifs, arrivées, ancienneté, qualité des fiches.
// Tout est calculé sur l'entreprise de l'appelant (RG05) et réservé à « utilisateurs.gerer ».
// Les comptes sont lus en une fois (colonnes utiles seulement) : adapté à une entreprise, pas à une plateforme.
class RhTableauDeBordController extends Controller
{
    private const NB_MOIS = 12;
    private const LIMITE_LISTES = 5;
    private const HORIZON_ANNIVERSAIRES_JOURS = 30;
    private const LIMITE_FICHES = 6;

    public function __invoke(Request $request, AnniversairesEmbauche $anniversaires): JsonResponse
    {
        $entrepriseId = $request->user()->entreprise_id;
        $aujourdhui = now()->startOfDay();

        $comptes = Utilisateur::with('role:id,nom_role')
            ->where('entreprise_id', $entrepriseId)
            ->get(['id', 'nom', 'prenom', 'poste', 'telephone', 'date_embauche', 'statut_compte',
                'role_id', 'departement_id', 'superieur_id', 'updated_at']);

        $actifs = $comptes->where('statut_compte', 'actif')->values();
        $inactifs = $comptes->where('statut_compte', '!=', 'actif')->values();

        $departements = Departement::where('entreprise_id', $entrepriseId)
            ->with('responsable:id,nom,prenom,statut_compte')
            ->orderBy('nom_departement')
            ->get(['id', 'nom_departement', 'responsable_id']);

        return response()->json([
            'genere_le' => now()->toIso8601String(),
            'effectif' => $this->effectif($comptes, $actifs, $inactifs, $aujourdhui),
            'arrivees_par_mois' => $this->arriveesParMois($actifs, $aujourdhui),
            'departements' => $this->repartitionDepartements($actifs, $departements),
            'roles' => $this->repartitionRoles($actifs),
            'dernieres_arrivees' => $this->dernieresArrivees($actifs, $departements),
            'anniversaires' => $anniversaires->prochains($actifs, $aujourdhui, self::HORIZON_ANNIVERSAIRES_JOURS, self::LIMITE_LISTES + 3),
            'fiches' => $this->fiches($actifs),
            'alertes' => $this->alertes($actifs, $inactifs, $departements),
        ]);
    }

    private function effectif($comptes, $actifs, $inactifs, Carbon $aujourdhui): array
    {
        $avecDate = $actifs->filter(fn ($u) => $u->date_embauche !== null);
        $ancienneteMoyenne = $avecDate->isEmpty()
            ? null
            : round($avecDate->avg(fn ($u) => $u->date_embauche->diffInDays($aujourdhui, false) / 365.25), 1);

        $limite30 = $aujourdhui->copy()->subDays(30);

        return [
            'total' => $comptes->count(),
            'actifs' => $actifs->count(),
            'inactifs' => $inactifs->count(),
            'arrivees_30j' => $avecDate->filter(fn ($u) => $u->date_embauche->between($limite30, $aujourdhui))->count(),
            'avec_date_embauche' => $avecDate->count(),
            'anciennete_moyenne_annees' => $ancienneteMoyenne,
        ];
    }

    // Embauches par mois sur 12 mois, d'après la date d'embauche renseignée
    private function arriveesParMois($actifs, Carbon $aujourdhui): array
    {
        $debut = $aujourdhui->copy()->startOfMonth()->subMonths(self::NB_MOIS - 1);
        $parMois = $actifs
            ->filter(fn ($u) => $u->date_embauche !== null && $u->date_embauche->gte($debut) && $u->date_embauche->lte($aujourdhui))
            ->countBy(fn ($u) => $u->date_embauche->format('Y-m'));

        return collect(range(0, self::NB_MOIS - 1))->map(function ($i) use ($debut, $parMois) {
            $cle = $debut->copy()->addMonths($i)->format('Y-m');

            return ['mois' => $cle, 'arrivees' => (int) ($parMois[$cle] ?? 0)];
        })->all();
    }

    private function repartitionDepartements($actifs, $departements): array
    {
        $parDepartement = $actifs->countBy('departement_id');

        $lignes = $departements->map(fn ($d) => [
            'id' => $d->id,
            'nom_departement' => $d->nom_departement,
            'nb_employes' => (int) ($parDepartement[$d->id] ?? 0),
        ]);

        $sans = (int) ($parDepartement[''] ?? 0);
        if ($sans > 0) {
            $lignes->push(['id' => null, 'nom_departement' => 'Sans département', 'nb_employes' => $sans]);
        }

        return $lignes->sortByDesc('nb_employes')->values()->all();
    }

    private function repartitionRoles($actifs): array
    {
        return $actifs->countBy(fn ($u) => $u->role?->nom_role ?? 'Sans rôle')
            ->map(fn ($nb, $nom) => ['nom_role' => $nom, 'nb_utilisateurs' => (int) $nb])
            ->sortByDesc('nb_utilisateurs')
            ->values()
            ->all();
    }

    private function dernieresArrivees($actifs, $departements): array
    {
        $noms = $departements->pluck('nom_departement', 'id');

        return $actifs->filter(fn ($u) => $u->date_embauche !== null)
            ->sortByDesc(fn ($u) => $u->date_embauche->timestamp)
            ->take(self::LIMITE_LISTES)
            ->map(fn ($u) => [
                'id' => $u->id,
                'nom' => $u->nom,
                'prenom' => $u->prenom,
                'poste' => $u->poste,
                'departement' => $u->departement_id ? ($noms[$u->departement_id] ?? null) : null,
                'date_embauche' => $u->date_embauche->toDateString(),
            ])->values()->all();
    }

    // Complétude des fiches des comptes actifs : champs utiles au suivi RH
    private function fiches($actifs): array
    {
        $criteres = [
            'poste' => fn ($u) => filled($u->poste),
            'telephone' => fn ($u) => filled($u->telephone),
            'departement' => fn ($u) => $u->departement_id !== null,
            'superieur' => fn ($u) => $u->superieur_id !== null,
            'date_embauche' => fn ($u) => $u->date_embauche !== null,
        ];

        $nb = $actifs->count();
        $manques = [];
        $complets = 0;
        $incompletes = [];

        foreach ($actifs as $u) {
            $absents = [];
            foreach ($criteres as $cle => $present) {
                if (! $present($u)) {
                    $absents[] = $cle;
                    $manques[$cle] = ($manques[$cle] ?? 0) + 1;
                }
            }
            if ($absents === []) {
                $complets++;
            } else {
                $incompletes[] = ['id' => $u->id, 'nom' => $u->nom, 'prenom' => $u->prenom, 'manque' => $absents];
            }
        }

        // Les fiches les plus lacunaires d'abord
        usort($incompletes, fn ($a, $b) => count($b['manque']) <=> count($a['manque']) ?: strcmp($a['nom'], $b['nom']));

        return [
            'total' => $nb,
            'completes' => $complets,
            'taux_completude' => $nb > 0 ? (int) round($complets / $nb * 100) : 100,
            'manques' => [
                'poste' => (int) ($manques['poste'] ?? 0),
                'telephone' => (int) ($manques['telephone'] ?? 0),
                'departement' => (int) ($manques['departement'] ?? 0),
                'superieur' => (int) ($manques['superieur'] ?? 0),
                'date_embauche' => (int) ($manques['date_embauche'] ?? 0),
            ],
            'a_completer' => array_slice($incompletes, 0, self::LIMITE_FICHES),
        ];
    }

    private function alertes($actifs, $inactifs, $departements): array
    {
        $sansResponsable = $departements->filter(
            fn ($d) => $d->responsable_id === null || $d->responsable?->statut_compte !== 'actif'
        );

        return [
            'departements_sans_responsable' => [
                'total' => $sansResponsable->count(),
                'departements' => $sansResponsable->take(self::LIMITE_LISTES)
                    ->map(fn ($d) => ['id' => $d->id, 'nom_departement' => $d->nom_departement])->values()->all(),
            ],
            'comptes_inactifs' => [
                'total' => $inactifs->count(),
                'comptes' => $inactifs->sortByDesc(fn ($u) => $u->updated_at?->timestamp ?? 0)
                    ->take(self::LIMITE_LISTES)
                    ->map(fn ($u) => ['id' => $u->id, 'nom' => $u->nom, 'prenom' => $u->prenom, 'poste' => $u->poste])
                    ->values()->all(),
            ],
        ];
    }
}

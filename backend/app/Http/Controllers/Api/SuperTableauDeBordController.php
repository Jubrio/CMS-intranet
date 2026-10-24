<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entreprise;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use App\Models\Utilisateur;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

// Tableau de bord de la plateforme (Super-administrateur).
// Ne renvoie que des compteurs et la configuration : jamais les contenus des entreprises (RG06).
class SuperTableauDeBordController extends Controller
{
    private const NB_MOIS = 12;
    private const LIMITE_LISTES = 5;

    public function __invoke(): JsonResponse
    {
        $maintenant = now();

        $nbEntreprises = Entreprise::count();
        $nbActives = Entreprise::where('statut_entreprise', 'active')->count();

        $comptes = Utilisateur::whereNotNull('entreprise_id');
        $nbComptes = (clone $comptes)->count();
        $nbComptesActifs = (clone $comptes)->where('statut_compte', 'actif')->count();

        // Modules : nombre d'entreprises qui utilisent chacun
        $usages = ModuleEntreprise::where('module_actif', true)
            ->select('module_id', DB::raw('count(*) as nb'))
            ->groupBy('module_id')
            ->pluck('nb', 'module_id');

        $modules = Module::orderByDesc('module_obligatoire')->orderBy('nom_module')->get();
        $adoption = $modules->map(fn (Module $m) => [
            'code_module' => $m->code_module,
            'nom_module' => $m->nom_module,
            'module_obligatoire' => $m->module_obligatoire,
            'nb_entreprises' => (int) ($usages[$m->id] ?? 0),
        ])->values();

        $totalOptionnelsActifs = $modules->where('module_obligatoire', false)
            ->sum(fn (Module $m) => (int) ($usages[$m->id] ?? 0));

        return response()->json([
            'genere_le' => $maintenant->toIso8601String(),
            'entreprises' => [
                'total' => $nbEntreprises,
                'actives' => $nbActives,
                'suspendues' => $nbEntreprises - $nbActives,
                'nouvelles_7j' => Entreprise::where('created_at', '>=', $maintenant->copy()->subDays(7))->count(),
                'nouvelles_30j' => Entreprise::where('created_at', '>=', $maintenant->copy()->subDays(30))->count(),
            ],
            'utilisateurs' => [
                'total' => $nbComptes,
                'actifs' => $nbComptesActifs,
                'inactifs' => $nbComptes - $nbComptesActifs,
                'nouveaux_30j' => (clone $comptes)->where('created_at', '>=', $maintenant->copy()->subDays(30))->count(),
                'moyenne_par_entreprise' => $nbEntreprises > 0 ? round($nbComptes / $nbEntreprises, 1) : 0,
            ],
            'modules' => [
                'total' => $modules->count(),
                'moyenne_optionnels_par_entreprise' => $nbEntreprises > 0 ? round($totalOptionnelsActifs / $nbEntreprises, 1) : 0,
                'adoption' => $adoption,
            ],
            'croissance' => $this->croissance($maintenant),
            'roles' => $this->repartitionRoles(),
            'plus_grandes' => $this->plusGrandes(),
            'dernieres' => $this->dernieres(),
            'alertes' => $this->alertes(),
        ]);
    }

    // Créations par mois sur les 12 derniers mois (calculé en PHP : indépendant du SGBD)
    private function croissance(Carbon $maintenant): array
    {
        $debut = $maintenant->copy()->startOfMonth()->subMonths(self::NB_MOIS - 1);

        $parMois = fn ($dates) => collect($dates)->countBy(fn ($d) => Carbon::parse($d)->format('Y-m'));
        $entreprises = $parMois(Entreprise::where('created_at', '>=', $debut)->pluck('created_at'));
        $utilisateurs = $parMois(Utilisateur::whereNotNull('entreprise_id')->where('created_at', '>=', $debut)->pluck('created_at'));

        return collect(range(0, self::NB_MOIS - 1))->map(function ($i) use ($debut, $entreprises, $utilisateurs) {
            $mois = $debut->copy()->addMonths($i);
            $cle = $mois->format('Y-m');

            return [
                'mois' => $cle,
                'entreprises' => (int) ($entreprises[$cle] ?? 0),
                'utilisateurs' => (int) ($utilisateurs[$cle] ?? 0),
            ];
        })->all();
    }

    private function repartitionRoles(): array
    {
        return Utilisateur::query()
            ->join('roles', 'roles.id', '=', 'utilisateurs.role_id')
            ->whereNotNull('utilisateurs.entreprise_id')
            ->select('roles.nom_role', DB::raw('count(*) as nb'))
            ->groupBy('roles.nom_role')
            ->orderByDesc('nb')
            ->get()
            ->map(fn ($r) => ['nom_role' => $r->nom_role, 'nb_utilisateurs' => (int) $r->nb])
            ->all();
    }

    private function plusGrandes(): array
    {
        return Entreprise::withCount('utilisateurs as nb_utilisateurs')
            ->orderByDesc('nb_utilisateurs')->orderBy('nom_entreprise')
            ->limit(self::LIMITE_LISTES)
            ->get()
            ->map(fn ($e) => $this->resume($e))
            ->all();
    }

    private function dernieres(): array
    {
        return Entreprise::withCount('utilisateurs as nb_utilisateurs')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit(self::LIMITE_LISTES)
            ->get()
            ->map(fn ($e) => $this->resume($e) + ['created_at' => $e->created_at?->toIso8601String()])
            ->all();
    }

    // Points d'attention : chaque alerte donne le total et un échantillon d'entreprises
    private function alertes(): array
    {
        $suspendues = Entreprise::where('statut_entreprise', '!=', 'active');

        // Intranet actif dont plus aucun administrateur ne peut se connecter
        $sansAdmin = Entreprise::where('statut_entreprise', 'active')
            ->whereDoesntHave('utilisateurs', fn ($q) => $q
                ->where('statut_compte', 'actif')
                ->whereHas('role', fn ($r) => $r->where('nom_role', 'Administrateur')));

        // Intranet actif qui n'a activé aucun module optionnel : probablement pas encore adopté
        $sansOptionnel = Entreprise::where('statut_entreprise', 'active')
            ->whereDoesntHave('modules', fn ($q) => $q
                ->where('module_actif', true)
                ->whereHas('module', fn ($m) => $m->where('module_obligatoire', false)));

        $echantillon = fn ($requete) => [
            'total' => (clone $requete)->count(),
            'entreprises' => (clone $requete)->orderBy('nom_entreprise')->limit(self::LIMITE_LISTES)
                ->get(['id', 'nom_entreprise', 'slug'])
                ->map(fn ($e) => ['id' => $e->id, 'nom_entreprise' => $e->nom_entreprise, 'slug' => $e->slug])
                ->all(),
        ];

        return [
            'suspendues' => $echantillon($suspendues),
            'sans_administrateur_actif' => $echantillon($sansAdmin),
            'sans_module_optionnel' => $echantillon($sansOptionnel),
        ];
    }

    private function resume(Entreprise $e): array
    {
        return [
            'id' => $e->id,
            'nom_entreprise' => $e->nom_entreprise,
            'slug' => $e->slug,
            'statut_entreprise' => $e->statut_entreprise === 'active' ? 'active' : 'suspendue',
            'nb_utilisateurs' => (int) $e->nb_utilisateurs,
        ];
    }
}

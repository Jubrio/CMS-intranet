<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entreprise;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

// Catalogue des modules vu par le Super-administrateur (consultation).
// Le catalogue est défini par le ModuleSeeder, qui réécrit nom et description à chaque
// exécution : il n'est donc pas modifiable depuis l'API.
class SuperModuleController extends Controller
{
    public function index(): JsonResponse
    {
        $usages = ModuleEntreprise::where('module_actif', true)
            ->select('module_id', DB::raw('count(*) as nb'))
            ->groupBy('module_id')
            ->pluck('nb', 'module_id');

        $modules = Module::withCount('permissions')
            ->orderByDesc('module_obligatoire')
            ->orderBy('nom_module')
            ->get()
            ->map(fn (Module $m) => $this->formater($m, (int) ($usages[$m->id] ?? 0)))
            ->values();

        return response()->json([
            'total_entreprises' => Entreprise::count(),
            'modules' => $modules,
        ]);
    }

    public function show(string $code): JsonResponse
    {
        $module = Module::withCount('permissions')->where('code_module', $code)->firstOrFail();

        $entreprisesQuery = Entreprise::whereHas(
            'modules',
            fn ($q) => $q->where('module_id', $module->id)->where('module_actif', true)
        );
        $nbEntreprises = (clone $entreprisesQuery)->count();

        return response()->json($this->formater($module, $nbEntreprises) + [
            'permissions' => $module->permissions()
                ->orderBy('code_permission')
                ->get(['code_permission', 'libelle_permission']),
            'entreprises' => $entreprisesQuery
                ->orderBy('nom_entreprise')
                ->limit(100)
                ->get(['id', 'nom_entreprise', 'slug', 'statut_entreprise'])
                ->map(fn ($e) => [
                    'id' => $e->id,
                    'nom_entreprise' => $e->nom_entreprise,
                    'slug' => $e->slug,
                    'statut_entreprise' => $e->statut_entreprise === 'active' ? 'active' : 'suspendue',
                ])->values(),
        ]);
    }

    private function formater(Module $m, int $nbEntreprises): array
    {
        return [
            'code_module' => $m->code_module,
            'nom_module' => $m->nom_module,
            'description_module' => $m->description_module,
            'module_obligatoire' => $m->module_obligatoire,
            'nb_permissions' => (int) $m->permissions_count,
            'nb_entreprises' => $nbEntreprises,
        ];
    }
}

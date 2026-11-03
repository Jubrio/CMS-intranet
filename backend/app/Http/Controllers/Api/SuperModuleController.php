<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entreprise;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use App\Models\Permission;
use App\Services\JournalOperations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SuperModuleController extends Controller
{
    public function index(): JsonResponse
    {
        $usages = ModuleEntreprise::where('module_actif', true)
            ->select('module_id', DB::raw('count(*) as nb'))
            ->groupBy('module_id')
            ->pluck('nb', 'module_id');

        $modules = Module::auCatalogue()->withCount('permissions')
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
        $module = Module::auCatalogue()->withCount('permissions')->where('code_module', $code)->firstOrFail();

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

    /** Ajoute un module au catalogue (toujours facultatif à sa création). */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'code_module' => ['required', 'string', 'max:30', 'regex:/^[a-z_]+$/', 'unique:modules,code_module'],
            'nom_module' => ['required', 'string', 'max:50'],
            'description_module' => ['nullable', 'string', 'max:250'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.code_permission' => ['required', 'string', 'max:60', 'regex:/^[a-z_]+\.[a-z_]+$/', 'distinct'],
            'permissions.*.libelle_permission' => ['required', 'string', 'max:150'],
        ], $this->messages());

        $this->verifierPermissions($donnees['code_module'], $donnees['permissions'] ?? []);

        $module = DB::transaction(function () use ($donnees) {
            $module = Module::create([
                'code_module' => $donnees['code_module'],
                'nom_module' => $donnees['nom_module'],
                'description_module' => $donnees['description_module'] ?? null,
                'module_obligatoire' => false,
                'actif_global' => true,
            ]);
            $this->enregistrerPermissions($module, $donnees['permissions'] ?? []);

            return $module;
        });

        JournalOperations::enregistrer($request->user(), 'ajouter', 'module', $module->id, $module->code_module);

        return response()->json($this->detail($module->fresh()), 201);
    }

    /** Modifie le nom, la description et les permissions associées (le code ne change jamais). */
    public function update(Request $request, string $code): JsonResponse
    {
        $module = Module::auCatalogue()->where('code_module', $code)->firstOrFail();

        $donnees = $request->validate([
            'nom_module' => ['required', 'string', 'max:50'],
            'description_module' => ['nullable', 'string', 'max:250'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.code_permission' => ['required', 'string', 'max:60', 'regex:/^[a-z_]+\.[a-z_]+$/', 'distinct'],
            'permissions.*.libelle_permission' => ['required', 'string', 'max:150'],
        ], $this->messages());

        $this->verifierPermissions($module->code_module, $donnees['permissions'] ?? [], $module);

        DB::transaction(function () use ($module, $donnees) {
            $module->update([
                'nom_module' => $donnees['nom_module'],
                'description_module' => $donnees['description_module'] ?? null,
            ]);
            $this->enregistrerPermissions($module, $donnees['permissions'] ?? []);
        });

        JournalOperations::enregistrer($request->user(), 'modifier', 'module', $module->id, $module->code_module);

        return response()->json($this->detail($module->fresh()));
    }

    /**
     * Désactive ou réactive globalement un module : il n'est plus proposé aux nouvelles entreprises,
     * celles qui l'utilisent déjà le conservent.
     */
    public function changerEtat(Request $request, string $code): JsonResponse
    {
        $donnees = $request->validate(['actif_global' => ['required', 'boolean']], [
            'actif_global.required' => "L'état est obligatoire.",
            'actif_global.boolean' => 'État invalide.',
        ]);
        $module = Module::auCatalogue()->where('code_module', $code)->firstOrFail();

        if ($module->module_obligatoire && ! $donnees['actif_global']) {
            return response()->json(['message' => 'Un module obligatoire ne peut pas être désactivé.'], 422);
        }

        $module->update(['actif_global' => (bool) $donnees['actif_global']]);
        JournalOperations::enregistrer(
            $request->user(), $donnees['actif_global'] ? 'reactiver' : 'desactiver', 'module', $module->id, $module->code_module
        );

        return response()->json($this->detail($module->fresh()));
    }

    /**
     * Retire un module du catalogue. Les données des entreprises sont conservées ; si des entreprises
     * l'utilisent, une confirmation explicite (confirmer = true) est exigée.
     */
    public function destroy(Request $request, string $code): JsonResponse
    {
        $module = Module::auCatalogue()->where('code_module', $code)->firstOrFail();

        if ($module->module_obligatoire) {
            return response()->json(['message' => 'Un module obligatoire ne peut pas être retiré.'], 422);
        }

        $nb = ModuleEntreprise::where('module_id', $module->id)->where('module_actif', true)->count();
        if ($nb > 0 && ! $request->boolean('confirmer')) {
            return response()->json([
                'message' => "Ce module est utilisé par {$nb} entreprise(s). Confirmez le retrait : leurs données seront conservées.",
                'nb_entreprises' => $nb,
                'confirmation_requise' => true,
            ], 409);
        }

        $module->update(['retire_le' => now(), 'actif_global' => false]);
        JournalOperations::enregistrer($request->user(), 'retirer', 'module', $module->id, $module->code_module, ['nb_entreprises' => $nb]);

        return response()->json(['message' => 'Module retiré du catalogue.', 'nb_entreprises' => $nb]);
    }

    private function messages(): array
    {
        return [
            'code_module.required' => 'Le code du module est obligatoire.',
            'code_module.unique' => 'Ce code de module existe déjà.',
            'code_module.regex' => 'Le code ne peut contenir que des minuscules et des « _ ».',
            'nom_module.required' => 'Le nom du module est obligatoire.',
            'permissions.*.code_permission.regex' => 'Une permission s’écrit « module.action » (minuscules).',
            'permissions.*.code_permission.distinct' => 'Une permission est en double.',
            'permissions.*.libelle_permission.required' => 'Chaque permission doit avoir un libellé.',
        ];
    }

    /** Une permission doit commencer par le code de son module et ne pas appartenir à un autre module. */
    private function verifierPermissions(string $codeModule, array $permissions, ?Module $module = null): void
    {
        foreach ($permissions as $i => $p) {
            $code = $p['code_permission'];
            if (! str_starts_with($code, $codeModule.'.')) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "permissions.$i.code_permission" => "La permission doit commencer par « {$codeModule}. ».",
                ]);
            }
            $existante = Permission::where('code_permission', $code)->first();
            if ($existante && (! $module || $existante->module_id !== $module->id)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "permissions.$i.code_permission" => 'Cette permission existe déjà.',
                ]);
            }
        }
    }

    private function enregistrerPermissions(Module $module, array $permissions): void
    {
        foreach ($permissions as $p) {
            Permission::updateOrCreate(
                ['code_permission' => $p['code_permission']],
                ['module_id' => $module->id, 'libelle_permission' => $p['libelle_permission']]
            );
        }
    }

    private function detail(Module $module): array
    {
        $module->loadCount('permissions');
        $nb = ModuleEntreprise::where('module_id', $module->id)->where('module_actif', true)->count();

        return $this->formater($module, $nb) + [
            'permissions' => $module->permissions()->orderBy('code_permission')
                ->get(['code_permission', 'libelle_permission']),
        ];
    }

    private function formater(Module $m, int $nbEntreprises): array
    {
        return [
            'code_module' => $m->code_module,
            'nom_module' => $m->nom_module,
            'description_module' => $m->description_module,
            'module_obligatoire' => $m->module_obligatoire,
            'actif_global' => (bool) $m->actif_global,
            'nb_permissions' => (int) $m->permissions_count,
            'nb_entreprises' => $nbEntreprises,
        ];
    }
}

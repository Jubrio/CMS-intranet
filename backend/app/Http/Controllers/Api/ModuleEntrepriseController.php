<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuleEntrepriseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $entrepriseId = $request->user()->entreprise_id;
        if (! $entrepriseId) {
            return response()->json(['message' => 'Aucune entreprise associée.'], 403);
        }

        $etats = ModuleEntreprise::where('entreprise_id', $entrepriseId)
            ->pluck('module_actif', 'module_id');

        $modules = Module::orderByDesc('module_obligatoire')->orderBy('nom_module')->get()
            ->map(fn ($m) => [
                'code_module' => $m->code_module,
                'nom_module' => $m->nom_module,
                'description_module' => $m->description_module,
                'module_obligatoire' => $m->module_obligatoire,
                'actif' => (bool) ($etats[$m->id] ?? false),
            ]);

        return response()->json($modules);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $entrepriseId = $request->user()->entreprise_id;
        if (! $entrepriseId) {
            return response()->json(['message' => 'Aucune entreprise associée.'], 403);
        }

        $request->validate(['actif' => ['required', 'boolean']]);
        $actif = $request->boolean('actif');
        $module = Module::where('code_module', $code)->firstOrFail();

        if ($module->module_obligatoire && ! $actif) { 
            return response()->json(['message' => 'Ce module est obligatoire et ne peut pas être désactivé.'], 422);
        }

        $ligne = ModuleEntreprise::firstOrNew(['entreprise_id' => $entrepriseId, 'module_id' => $module->id]);
        $ligne->module_actif = $actif;
        if ($actif) {
            $ligne->date_activation = now();
        }
        $ligne->save(); 

        return response()->json(['code_module' => $code, 'actif' => $actif]);
    }
}
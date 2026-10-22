<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerMenuRequest;
use App\Models\Menu;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MenuGestionController extends Controller
{
    private const MAX_LIENS = 30;
    public const ORDRE_LIEN = 1000; // un lien sans ordre se place apres les modules

    // Vue complete pour l'administrateur : modules actifs (avec ou sans reglage) et liens
    public function index(Request $request): JsonResponse
    {
        $eid = $request->user()->entreprise_id;
        $lignes = Menu::where('entreprise_id', $eid)->with('roles')->get();
        $parModule = $lignes->where('type_menu', 'module')->keyBy('module_id');

        $modules = Menu::modulesActifs($eid)
            ->filter(fn ($m) => $m->code_module !== 'pages')
            ->map(fn ($m) => $this->formaterModule($m, $parModule->get($m->id)))
            ->sortBy('ordre')->values();

        $liens = $lignes->where('type_menu', 'lien')
            ->sortBy(fn ($l) => $l->ordre_menu ?? self::ORDRE_LIEN)
            ->map(fn ($l) => $this->formaterLien($l))->values();

        return response()->json(['modules' => $modules, 'liens' => $liens]);
    }

    public function modifierModule(EnregistrerMenuRequest $request, string $code): JsonResponse
    {
        $eid = $request->user()->entreprise_id;
        if ($code === 'pages') {
            return response()->json(['message' => 'Les pages se rangent par rubrique (emplacement_menu), pas par entrée de menu.'], 422);
        }
        $module = Menu::modulesActifs($eid)->firstWhere('code_module', $code);
        abort_unless($module, 404, 'Module introuvable ou inactif.');

        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        $ligne = Menu::firstOrNew(['entreprise_id' => $eid, 'type_menu' => 'module', 'module_id' => $module->id]);
        $this->appliquer($ligne, $d);

        return response()->json($this->formaterModule($module, $ligne->load('roles')));
    }

    // Retour au comportement par defaut : on supprime le reglage (idempotent)
    public function reinitialiserModule(Request $request, string $code): JsonResponse
    {
        $module = DB::table('modules')->where('code_module', $code)->first();
        abort_unless($module, 404, 'Module introuvable.');

        Menu::where('entreprise_id', $request->user()->entreprise_id)
            ->where('type_menu', 'module')->where('module_id', $module->id)->delete();

        return response()->json(['message' => 'Entrée réinitialisée.']);
    }

    public function creerLien(EnregistrerMenuRequest $request): JsonResponse
    {
        $eid = $request->user()->entreprise_id;
        if (Menu::where('entreprise_id', $eid)->where('type_menu', 'lien')->count() >= self::MAX_LIENS) {
            return response()->json(['message' => 'Limite de ' . self::MAX_LIENS . ' liens atteinte.'], 422);
        }

        $ligne = new Menu([
            'entreprise_id' => $eid, 'type_menu' => 'lien',
            'ordre_menu' => self::ORDRE_LIEN, 'visible' => true, 'roles_limites' => false,
        ]);
        $this->appliquer($ligne, $request->validated());

        return response()->json($this->formaterLien($ligne->load('roles')), 201);
    }

    public function modifierLien(EnregistrerMenuRequest $request, int $id): JsonResponse
    {
        $ligne = $this->lien($request, $id);
        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }
        $this->appliquer($ligne, $d);

        return response()->json($this->formaterLien($ligne->load('roles')));
    }

    public function supprimerLien(Request $request, int $id): JsonResponse
    {
        $this->lien($request, $id)->delete();

        return response()->json(['message' => 'Lien supprimé.']);
    }

    // ---------- outils ----------

    // 404 hors entreprise ou hors type lien (RG05)
    private function lien(Request $request, int $id): Menu
    {
        return Menu::where('entreprise_id', $request->user()->entreprise_id)
            ->where('type_menu', 'lien')->findOrFail($id);
    }

    // Seules les cles envoyees sont modifiees ; roles = null leve la restriction
    private function appliquer(Menu $ligne, array $d): void
    {
        foreach (['libelle_menu', 'url_menu', 'ordre_menu', 'visible'] as $champ) {
            if (array_key_exists($champ, $d)) {
                $ligne->{$champ} = $d[$champ];
            }
        }
        if (array_key_exists('roles', $d)) {
            $ligne->roles_limites = $d['roles'] !== null;
        }

        DB::transaction(function () use ($ligne, $d) {
            $ligne->save();
            if (array_key_exists('roles', $d)) {
                $ligne->roles()->sync($d['roles'] ?? []);
            }
        });
    }

    // null = tous les roles ; tableau (eventuellement vide) = roles autorises
    private function roles(?Menu $l): ?array
    {
        if (! $l || ! $l->roles_limites) {
            return null;
        }

        return $l->roles->pluck('id')->values()->all();
    }

    private function formaterModule(object $m, ?Menu $l): array
    {
        return [
            'code' => $m->code_module,
            'libelle_defaut' => $m->nom_module,
            'libelle' => $l?->libelle_menu ?? $m->nom_module,
            'ordre' => $l?->ordre_menu ?? $m->id * 10,
            'visible' => $l?->visible ?? true,
            'roles' => $this->roles($l),
            'personnalise' => $l?->exists ?? false,
        ];
    }

    private function formaterLien(Menu $l): array
    {
        return [
            'id' => $l->id,
            'libelle_menu' => $l->libelle_menu,
            'url_menu' => $l->url_menu,
            'ordre_menu' => $l->ordre_menu ?? self::ORDRE_LIEN,
            'visible' => $l->visible,
            'roles' => $this->roles($l),
        ];
    }
}
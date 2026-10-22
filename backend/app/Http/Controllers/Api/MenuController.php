<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    // Menu de l'appelant (RG36, RG37) :
    //  - modules actifs dont son role a au moins une permission, avec les reglages de l'administrateur
    //  - liens personnalises visibles pour son role
    //  - pages publiees qui lui sont destinees, groupees par rubrique (RG35)
    // Le menu ne donne jamais un droit que les permissions refusent.
    public function index(Request $request): JsonResponse
    {
        $u = $request->user();
        $actifs = Menu::modulesActifs($u->entreprise_id);

        $codes = $u->role->permissions()->pluck('code_permission');
        $permis = $codes->map(fn ($c) => explode('.', $c)[0])->unique()->all();

        $lignes = Menu::where('entreprise_id', $u->entreprise_id)->with('roles')->get();
        $parModule = $lignes->where('type_menu', 'module')->keyBy('module_id');

        // Une entree est montree si elle n'est pas masquee et si le role est autorise
        // (liste de roles vide + roles_limites = personne : on ne s'ouvre jamais par erreur)
        $montre = fn (Menu $l) => $l->visible
            && (! $l->roles_limites || $l->roles->contains('id', $u->role_id));

        $modules = $actifs
            ->filter(fn ($m) => in_array($m->code_module, $permis, true) && $m->code_module !== 'pages')
            ->map(function ($m) use ($parModule, $montre) {
                $l = $parModule->get($m->id);
                if ($l && ! $montre($l)) {
                    return null;
                }

                return [
                    'code' => $m->code_module,
                    'libelle' => $l?->libelle_menu ?? $m->nom_module,
                    'ordre' => $l?->ordre_menu ?? $m->id * 10,
                ];
            })
            ->filter()->sortBy('ordre')->values();

        $liens = $lignes->where('type_menu', 'lien')
            ->filter(fn ($l) => $montre($l))
            ->sortBy(fn ($l) => $l->ordre_menu ?? MenuGestionController::ORDRE_LIEN)
            ->map(fn ($l) => [
                'id' => $l->id,
                'libelle' => $l->libelle_menu,
                'url' => $l->url_menu,
                'ordre' => $l->ordre_menu ?? MenuGestionController::ORDRE_LIEN,
            ])->values();

        // Pages : seulement si le module pages est actif ET que le role peut les consulter
        $pagesActives = $actifs->contains(fn ($m) => $m->code_module === 'pages')
            && $codes->contains('pages.consulter');

        $rubriques = collect();
        if ($pagesActives) {
            $rubriques = PageController::requeteVisibles($u, false)
                ->orderBy('emplacement_menu')->orderBy('titre')->limit(200)
                ->get(['id', 'titre', 'emplacement_menu'])
                ->groupBy(fn ($p) => $p->emplacement_menu ?: 'Pages')
                ->map(fn ($pages, $rubrique) => [
                    'rubrique' => $rubrique,
                    'pages' => $pages->map(fn ($p) => ['id' => $p->id, 'titre' => $p->titre])->values(),
                ])->values();
        }

        return response()->json(['modules' => $modules, 'liens' => $liens, 'pages' => $rubriques]);
    }
}
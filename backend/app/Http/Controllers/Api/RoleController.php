<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerRoleRequest;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    public function __construct(private DroitsUtilisateurs $droits) {}

    // Catalogue des permissions : le frontend les regroupe par code_module
    public function permissions(): JsonResponse
    {
        $liste = DB::table('permissions')
            ->join('modules', 'modules.id', '=', 'permissions.module_id')
            ->orderBy('modules.id')->orderBy('permissions.id')
            ->get(['permissions.code_permission', 'permissions.libelle_permission', 'modules.code_module']);

        return response()->json($liste);
    }

    // Rôles que l'appelant peut attribuer à un compte (RG32) : utile au formulaire de création de compte
    public function assignables(Request $request): JsonResponse
    {
        $appelant = $request->user();

        $roles = Role::where('entreprise_id', $appelant->entreprise_id)
            ->orderBy('id')->get()
            ->filter(fn ($r) => $this->droits->roleAttribuable($appelant, $r))
            ->map(fn ($r) => ['id' => $r->id, 'nom_role' => $r->nom_role])
            ->values();

        return response()->json($roles);
    }

    public function index(Request $request): JsonResponse
    {
        $entrepriseId = $request->user()->entreprise_id; // RG05

        $comptes = Utilisateur::where('entreprise_id', $entrepriseId)
            ->selectRaw('role_id, count(*) as n')
            ->groupBy('role_id')
            ->pluck('n', 'role_id');

        $roles = Role::where('entreprise_id', $entrepriseId)
            ->withCount('permissions')
            ->orderBy('id')->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'nom_role' => $r->nom_role,
                'role_par_defaut' => (bool) $r->role_par_defaut,
                'nb_permissions' => $r->permissions_count,
                'nb_utilisateurs' => (int) ($comptes[$r->id] ?? 0),
            ]);

        return response()->json($roles);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->formater($this->trouver($request, $id)));
    }

    public function store(EnregistrerRoleRequest $request): JsonResponse
    {
        $appelant = $request->user();
        $donnees = $request->validated();

        if (! $this->detientToutes($appelant, $donnees['permissions'])) { // RG32
            return response()->json(['message' => 'Vous ne pouvez pas accorder des permissions que vous ne possédez pas.'], 403);
        }

        $role = DB::transaction(function () use ($appelant, $donnees) {
            $role = Role::create([
                'entreprise_id' => $appelant->entreprise_id,
                'nom_role' => $donnees['nom_role'],
                'role_par_defaut' => false,
            ]);
            $role->permissions()->sync($this->idsDe($donnees['permissions']));

            return $role;
        });

        return response()->json($this->formater($role), 201);
    }

    public function update(EnregistrerRoleRequest $request, int $id): JsonResponse
    {
        $appelant = $request->user();
        $role = $this->trouver($request, $id);
        $donnees = $request->validated();

        if ($role->role_par_defaut) { // RG10
            return response()->json(['message' => 'Les rôles par défaut ne sont pas modifiables.'], 422);
        }
        if (empty($donnees)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }
        if (! $this->droits->roleAttribuable($appelant, $role)) { // RG32
            return response()->json(['message' => 'Ce rôle possède des permissions que vous ne détenez pas.'], 403);
        }
        if (isset($donnees['permissions']) && ! $this->detientToutes($appelant, $donnees['permissions'])) { // RG32
            return response()->json(['message' => 'Vous ne pouvez pas accorder des permissions que vous ne possédez pas.'], 403);
        }

        DB::transaction(function () use ($role, $donnees) {
            if (isset($donnees['nom_role'])) {
                $role->update(['nom_role' => $donnees['nom_role']]);
            }
            if (isset($donnees['permissions'])) {
                $role->permissions()->sync($this->idsDe($donnees['permissions']));
            }
        });

        return response()->json($this->formater($role->fresh()));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $role = $this->trouver($request, $id);

        if ($role->role_par_defaut) { // RG10
            return response()->json(['message' => 'Un rôle par défaut ne peut pas être supprimé.'], 422);
        }
        if (Utilisateur::where('role_id', $role->id)->exists()) { // RG10
            return response()->json(['message' => 'Ce rôle est attribué à des comptes : réaffectez-les avant de le supprimer.'], 422);
        }
        if (! $this->droits->roleAttribuable($request->user(), $role)) { // RG32
            return response()->json(['message' => 'Ce rôle possède des permissions que vous ne détenez pas.'], 403);
        }

        DB::transaction(function () use ($role) {
            $role->permissions()->detach();
            $role->delete();
        });

        return response()->json(['message' => 'Rôle supprimé.']);
    }

    private function detientToutes(Utilisateur $appelant, array $codes): bool
    {
        $detenues = $appelant->role->permissions()->pluck('code_permission');

        return collect($codes)->diff($detenues)->isEmpty();
    }

    private function idsDe(array $codes): array
    {
        return Permission::whereIn('code_permission', $codes)->pluck('id')->all();
    }

    // 404 pour un rôle d'une autre entreprise ou pour le rôle Super-administrateur (RG05)
    private function trouver(Request $request, int $id): Role
    {
        return Role::where('entreprise_id', $request->user()->entreprise_id)->findOrFail($id);
    }

    private function formater(Role $r): array
    {
        return [
            'id' => $r->id,
            'nom_role' => $r->nom_role,
            'role_par_defaut' => (bool) $r->role_par_defaut,
            'permissions' => $r->permissions()->pluck('code_permission')->values(),
        ];
    }
}

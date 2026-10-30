<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerDepartementRequest;
use App\Models\Departement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $liste = Departement::with('responsable:id,nom,prenom')
            ->withCount('utilisateurs')
            ->where('entreprise_id', $request->user()->entreprise_id)
            ->orderBy('nom_departement')
            ->get()
            ->map(fn ($d) => $this->formater($d));

        return response()->json($liste);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->formater($this->trouver($request, $id)));
    }

    public function store(EnregistrerDepartementRequest $request): JsonResponse
    {
        $departement = Departement::create(
            $request->validated() + ['entreprise_id' => $request->user()->entreprise_id]
        );

        return response()->json($this->formater($this->trouver($request, $departement->id)), 201);
    }

    public function update(EnregistrerDepartementRequest $request, int $id): JsonResponse
    {
        $departement = $this->trouver($request, $id);
        $donnees = $request->validated();

        if (empty($donnees)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        if (array_key_exists('departement_parent_id', $donnees)
            && $this->creeUnCycle($departement->id, $donnees['departement_parent_id'])) {
            return response()->json(['message' => 'Une hiérarchie circulaire est interdite.'], 422);
        }

        $departement->update($donnees);

        return response()->json($this->formater($this->trouver($request, $id)));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $departement = $this->trouver($request, $id);

        if ($departement->utilisateurs()->exists()) {
            return response()->json(['message' => 'Département non vide : réaffectez ses employés avant de le supprimer.'], 422);
        }

        $aDesEnfants = Departement::where('entreprise_id', $departement->entreprise_id)
            ->where('departement_parent_id', $departement->id)->exists();
        if ($aDesEnfants) {
            return response()->json(['message' => 'Ce département possède des sous-départements.'], 422);
        }

        $departement->delete();

        return response()->json(['message' => 'Département supprimé.']);
    }

    private function creeUnCycle(int $id, ?int $parentId): bool
    {
        $courant = $parentId;
        $vus = [];

        while ($courant !== null) {
            $courant = (int) $courant;
            if ($courant === $id || isset($vus[$courant])) {
                return true;
            }
            $vus[$courant] = true;
            $courant = Departement::where('id', $courant)->value('departement_parent_id');
        }

        return false;
    }

    private function trouver(Request $request, int $id): Departement
    {
        return Departement::with('responsable:id,nom,prenom')
            ->withCount('utilisateurs')
            ->where('entreprise_id', $request->user()->entreprise_id)
            ->findOrFail($id);
    }

    private function formater(Departement $d): array
    {
        return [
            'id' => $d->id,
            'nom_departement' => $d->nom_departement,
            'description_departement' => $d->description_departement,
            'departement_parent_id' => $d->departement_parent_id,
            'responsable_id' => $d->responsable_id,
            'responsable' => $d->responsable?->only(['id', 'nom', 'prenom']),
            'nb_employes' => $d->utilisateurs_count,
        ];
    }
}

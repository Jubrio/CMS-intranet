<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Utilisateur;
use App\Services\DroitsUtilisateurs;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Services\HierarchieUtilisateurs;

class AnnuaireController extends Controller
{
    private const CHAMPS = [
        'utilisateurs.id', 'utilisateurs.nom', 'utilisateurs.prenom', 'utilisateurs.email',
        'utilisateurs.telephone', 'utilisateurs.poste', 'utilisateurs.photo',
        'utilisateurs.departement_id', 'departements.nom_departement',
    ];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'nullable|string|max:100',
            'departement_id' => 'nullable|integer',
        ]);

        $requete = $this->base($request);

        if ($q = trim((string) $request->query('q'))) {
            $motif = '%' . addcslashes($q, '%_\\') . '%';
            $requete->where(fn ($w) => $w
                ->where('utilisateurs.nom', 'ilike', $motif)
                ->orWhere('utilisateurs.prenom', 'ilike', $motif)
                ->orWhere('utilisateurs.poste', 'ilike', $motif)
                ->orWhere('departements.nom_departement', 'ilike', $motif));
        }
        if ($request->filled('departement_id')) {
            $requete->where('utilisateurs.departement_id', $request->query('departement_id'));
        }

        return response()->json(
            $requete->orderBy('utilisateurs.nom')->orderBy('utilisateurs.prenom')
                ->select(self::CHAMPS)->paginate(20)
        );
    }

    public function __construct(private DroitsUtilisateurs $droits)
    {
    }

        public function show(Request $request, int $id): JsonResponse
    {
        $fiche = $this->base($request)->where('utilisateurs.id', $id)
            ->select(array_merge(self::CHAMPS, ['utilisateurs.date_embauche', 'utilisateurs.superieur_id']))->first();
        abort_if(! $fiche, 404);

        $entrepriseId = $request->user()->entreprise_id;
        $fiche->superieur = $fiche->superieur_id
            ? DB::table('utilisateurs')->where('id', $fiche->superieur_id)
                ->where('entreprise_id', $entrepriseId)->where('statut_compte', 'actif')
                ->first(['id', 'nom', 'prenom', 'poste'])
            : null;
        $fiche->subordonnes = DB::table('utilisateurs')
            ->where('entreprise_id', $entrepriseId)->where('superieur_id', $fiche->id)
            ->where('statut_compte', 'actif')->orderBy('nom')
            ->get(['id', 'nom', 'prenom', 'poste']);

        return response()->json($fiche);
    }

    public function organigramme(Request $request): JsonResponse
    {
        $entrepriseId = $request->user()->entreprise_id; // RG05

        $deps = DB::table('departements')->where('entreprise_id', $entrepriseId)
            ->orderBy('nom_departement')->get();

        $effectifs = DB::table('utilisateurs')
            ->where('entreprise_id', $entrepriseId)->where('statut_compte', 'actif')
            ->whereNotNull('departement_id')
            ->selectRaw('departement_id, count(*) as n')->groupBy('departement_id')
            ->pluck('n', 'departement_id');

        $responsables = DB::table('utilisateurs')
            ->whereIn('id', $deps->pluck('responsable_id')->filter()->all())
            ->get(['id', 'nom', 'prenom', 'poste'])->keyBy('id');

        $enfantsDe = [];
        foreach ($deps as $d) {
            $enfantsDe[$d->departement_parent_id ?? 0][] = $d;
        }

        $construire = function (int $parent) use (&$construire, $enfantsDe, $effectifs, $responsables) {
            return array_map(fn ($d) => [
                'id' => $d->id,
                'nom_departement' => $d->nom_departement,
                'responsable' => $responsables[$d->responsable_id] ?? null,
                'nb_employes' => (int) ($effectifs[$d->id] ?? 0),
                'enfants' => $construire($d->id),
            ], $enfantsDe[$parent] ?? []);
        };

        return response()->json($construire(0));
    }

    // Organigramme des personnes : tous les comptes actifs avec leur supérieur (l'arbre est construit côté client)
    public function organigrammePersonnes(Request $request): JsonResponse
    {
        $personnes = $this->base($request)
            ->orderBy('utilisateurs.nom')->orderBy('utilisateurs.prenom')
            ->limit(1000)
            ->get(['utilisateurs.id', 'utilisateurs.nom', 'utilisateurs.prenom', 'utilisateurs.poste',
                'utilisateurs.photo', 'utilisateurs.superieur_id', 'departements.nom_departement']);

        return response()->json($personnes);
    }

    public function modifier(Request $request, int $id): JsonResponse
{
    $cible = $this->cible($request, $id);

        $donnees = $request->validate([
        'nom' => 'sometimes|string|max:50',
        'prenom' => 'sometimes|string|max:60',
        'poste' => 'sometimes|nullable|string|max:100',
        'telephone' => 'sometimes|nullable|string|max:20',
        'departement_id' => ['sometimes', 'nullable',
            Rule::exists('departements', 'id')->where('entreprise_id', $request->user()->entreprise_id)],
        'superieur_id' => ['sometimes', 'nullable', 'integer', Rule::notIn([$id]),
            Rule::exists('utilisateurs', 'id')
                ->where('entreprise_id', $request->user()->entreprise_id)
                ->where('statut_compte', 'actif')],
    ]);
    if (empty($donnees)) {
        return response()->json(['message' => 'Aucun champ à modifier.'], 422);
    }
        if (! empty($donnees['superieur_id'])
        && app(HierarchieUtilisateurs::class)->creeUnCycle($cible->id, (int) $donnees['superieur_id'])) {
        return response()->json(['message' => 'Ce choix créerait une boucle hiérarchique.',
            'errors' => ['superieur_id' => ['Ce choix créerait une boucle hiérarchique.']]], 422);
    }

    $cible->forceFill($donnees)->save();

    return response()->json($this->resume($cible->fresh()));
}

public function photo(Request $request, int $id): JsonResponse
{
    $cible = $this->cible($request, $id);

    $request->validate([
        'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048', // RG25
    ]);

    if ($cible->photo) {
        Storage::disk('public')->delete($cible->photo);
    }
    $chemin = $request->file('photo')->store('photos', 'public');
    $cible->forceFill(['photo' => $chemin])->save();

    return response()->json([
        'photo' => $chemin,
        'url' => asset('storage/' . $chemin),
    ]);
}

// 404 hors entreprise (RG05), 403 si le compte possède des permissions que l'appelant n'a pas (RG32)
private function cible(Request $request, int $id): Utilisateur
{
    $appelant = $request->user();
    $cible = Utilisateur::where('entreprise_id', $appelant->entreprise_id)->findOrFail($id);
    if (! $this->droits->roleAttribuable($appelant, $cible->role)) {
        abort(403, 'Ce compte possède des permissions que vous ne détenez pas.');
    }

    return $cible;
}

private function resume(Utilisateur $u): array
{
    return $u->only(['id', 'nom', 'prenom', 'email', 'telephone', 'poste', 'photo', 'departement_id', 'superieur_id']);
}
    private function base(Request $request)
    {
        return DB::table('utilisateurs')
            ->leftJoin('departements', 'departements.id', '=', 'utilisateurs.departement_id')
            ->where('utilisateurs.entreprise_id', $request->user()->entreprise_id)
            ->where('utilisateurs.statut_compte', 'actif');
    }
}
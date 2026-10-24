<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerPageRequest;
use App\Models\Contenu;
use App\Models\Image;
use App\Models\Utilisateur;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'statut' => 'nullable|in:brouillon,publie,archive',
            'q' => 'nullable|string|max:100',
        ]);
        $u = $request->user();
        $gestionnaire = $this->peutGerer($u);

        if ($request->filled('statut') && ! $gestionnaire) {
            abort(403, 'Action non autorisée.');
        }

        $requete = $this->visibles($u, $gestionnaire);
        if ($request->filled('statut')) {
            $requete->where('statut_contenu', $request->query('statut'));
        }
        if ($q = trim((string) $request->query('q'))) {
            $requete->where('titre', 'ilike', '%'.addcslashes($q, '%_\\').'%');
        }

        $page = $requete->with('auteur:id,nom,prenom')
            ->orderBy('emplacement_menu')->orderBy('titre')->paginate(20);

        // la liste ne renvoie pas le corps : il faut ouvrir la page pour le lire
        return response()->json($page->through(fn ($c) => $this->formater($c, false)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $u = $request->user();
        $c = $this->visibles($u, $this->peutGerer($u))
            ->with('auteur:id,nom,prenom', 'images')->findOrFail($id);

        $x = $this->formater($c, true);
        $x['images'] = $c->images->map(fn ($i) => PageImageController::formater($i))->all();

        return response()->json($x);
    }

    public function store(EnregistrerPageRequest $request): JsonResponse
    {
        $u = $request->user();
        $d = $request->validated();
        $statut = $d['statut_contenu'] ?? 'brouillon';

        $c = Contenu::create([
            'entreprise_id' => $u->entreprise_id, // RG05
            'auteur_id' => $u->id,
            'departement_id' => $d['visibilite'] === 'departement' ? $d['departement_id'] : null, // RG22
            'type_contenu' => 'page',
            'titre' => $d['titre'],
            'corps' => $d['corps'],
            'statut_contenu' => $statut,
            'visibilite' => $d['visibilite'],
            'date_publication' => $statut === 'publie' ? now() : null,
            'emplacement_menu' => $d['emplacement_menu'] ?? null,
        ]);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true), 201);
    }

    public function update(EnregistrerPageRequest $request, int $id): JsonResponse
    {
        $c = $this->gerer($request, $id);
        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        $visibilite = $d['visibilite'] ?? $c->visibilite;
        $dept = array_key_exists('departement_id', $d) ? $d['departement_id'] : $c->departement_id;
        if ($visibilite === 'entreprise') {
            $dept = null; // RG22
        }
        if ($visibilite === 'departement' && ! $dept) {
            return response()->json(['message' => 'Un département est requis.',
                'errors' => ['departement_id' => ['Un département est requis.']]], 422);
        }

        $c->update(array_diff_key($d, ['visibilite' => 1, 'departement_id' => 1])
            + ['visibilite' => $visibilite, 'departement_id' => $dept]);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true));
    }

    public function publier(Request $request, int $id): JsonResponse
    {
        $c = $this->gerer($request, $id);
        if ($c->statut_contenu === 'publie') {
            return response()->json(['message' => 'Cette page est déjà publiée.'], 422);
        }
        // la date de première publication est conservée en cas de republication
        $c->update(['statut_contenu' => 'publie', 'date_publication' => $c->date_publication ?? now()]);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true));
    }

    public function archiver(Request $request, int $id): JsonResponse
    {
        $c = $this->gerer($request, $id);
        if ($c->statut_contenu !== 'publie') {
            return response()->json(['message' => 'Seule une page publiée peut être archivée.'], 422);
        }
        $c->update(['statut_contenu' => 'archive']); // disparaît du menu, reste conservée

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $c = $this->gerer($request, $id);
        $chemins = Image::where('contenu_id', $c->id)->pluck('fichier')->all();
        $c->delete(); // les lignes images partent en cascade
        Storage::disk('local')->delete($chemins);

        return response()->json(['message' => 'Page supprimée.']);
    }

    // ---------- outils ----------

    private function peutGerer(Utilisateur $u): bool
    {
        return $u->role->permissions()->where('code_permission', 'pages.gerer')->exists();
    }

    // Gestionnaire : 404 hors entreprise ou hors type page (RG05)
    private function gerer(Request $request, int $id): Contenu
    {
        $u = $request->user();
        if (! $this->peutGerer($u)) {
            abort(403, 'Action non autorisée.');
        }

        return Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', 'page')->findOrFail($id);
    }

    public static function requeteVisibles(Utilisateur $u, bool $gestionnaire): Builder
    {
        $q = Contenu::where('entreprise_id', $u->entreprise_id)->where('type_contenu', 'page');
        if ($gestionnaire) {
            return $q;
        }

        return $q->where('statut_contenu', 'publie')->where(function ($w) use ($u) {
            $w->where('visibilite', 'entreprise');
            if ($u->departement_id) {
                $w->orWhere(fn ($w2) => $w2->where('visibilite', 'departement')
                    ->where('departement_id', $u->departement_id));
            }
        });
    }

    private function visibles(Utilisateur $u, bool $gestionnaire): Builder
    {
        return self::requeteVisibles($u, $gestionnaire);
    }

    private function formater(Contenu $c, bool $avecCorps): array
    {
        $x = [
            'id' => $c->id,
            'titre' => $c->titre,
            'visibilite' => $c->visibilite,
            'departement_id' => $c->departement_id,
            'statut_contenu' => $c->statut_contenu,
            'emplacement_menu' => $c->emplacement_menu,
            'date_publication' => $c->date_publication,
            'auteur' => $c->auteur ? $c->auteur->only(['id', 'nom', 'prenom']) : null,
            'updated_at' => $c->updated_at,
        ];
        if ($avecCorps) {
            $x['corps'] = $c->corps;
        }

        return $x;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerContenuRequest;
use App\Models\Contenu;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\LectureNote;

class ContenuController extends Controller
{
    public function __construct(private AccesContenus $acces) {}

    public function index(Request $request, string $type): JsonResponse
    {
        $u = $request->user();
        if (! $this->acces->autorise($u, $type, 'consulter')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        $statut = $request->query('statut', 'publie');
        if (! in_array($statut, ['brouillon', 'publie', 'archive'], true)) {
            return response()->json(['message' => 'Statut invalide.'], 422);
        }
        if ($statut !== 'publie' && ! $this->acces->autorise($u, $type, 'publier')) {
            return response()->json(['message' => 'Réservé aux personnes autorisées à publier.'], 403);
        }

        $requete = $this->visibles($u, $type)->where('statut_contenu', $statut);
        if ($statut === 'publie' && $type === 'annonce') {
            $this->sansExpirees($requete);
        }

        $page = $requete->with('auteur:id,nom,prenom')
            ->orderByDesc('date_publication')->orderByDesc('id')
            ->paginate(20);

        return response()->json($page->through(fn ($c) => $this->formater($c, false)));
    }

    public function show(Request $request, string $type, int $id): JsonResponse
    {
        $u = $request->user();
        if (! $this->acces->autorise($u, $type, 'consulter')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        $c = $this->visibles($u, $type)->with('auteur:id,nom,prenom')->findOrFail($id);

        $publie = $c->statut_contenu === 'publie'
            && ! ($type === 'annonce' && $c->date_expiration && $c->date_expiration->lt(today()));
        if (! $publie && $c->auteur_id !== $u->id && ! $this->acces->autorise($u, $type, 'publier')) {
            abort(404);
        }

        $x = $this->formater($c, true);
if ($type === 'note_service') {
    $l = LectureNote::where('contenu_id', $c->id)->where('utilisateur_id', $u->id)->first();
    $x['lu'] = (bool) $l;
    $x['date_lecture'] = $l?->date_lecture;
}

return response()->json($x);
    }

    public function store(EnregistrerContenuRequest $request, string $type): JsonResponse
    {
        $u = $request->user();
        $d = $request->validated();
        if (! $this->acces->peutCibler($u, $d['visibilite'], $d['departement_id'] ?? null)) { // RG21
            return response()->json(['message' => 'Un Manager ne publie que pour son département.'], 403);
        }

        $c = Contenu::create([
            'entreprise_id' => $u->entreprise_id, // RG20
            'auteur_id' => $u->id,
            'type_contenu' => $type,
            'titre' => $d['titre'],
            'corps' => $d['corps'],
            'categorie' => $d['categorie'] ?? null,
            'statut_contenu' => 'brouillon',
            'visibilite' => $d['visibilite'],
            'departement_id' => $d['visibilite'] === 'departement' ? $d['departement_id'] : null, // RG22
            'date_expiration' => $d['date_expiration'] ?? null,
            'numero_note' => $d['numero_note'] ?? null,
        ]);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true), 201);
    }

    public function update(EnregistrerContenuRequest $request, string $type, int $id): JsonResponse
    {
        $c = $this->gerer($request, $type, $id);
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
        if (! $this->acces->peutCibler($request->user(), $visibilite, $dept)) { // RG21
            return response()->json(['message' => 'Un Manager ne publie que pour son département.'], 403);
        }

        $c->update(Arr::only($d, ['titre', 'corps', 'categorie', 'date_expiration', 'numero_note'])
            + ['visibilite' => $visibilite, 'departement_id' => $dept]);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true));
    }

    public function publier(Request $request, string $type, int $id): JsonResponse
    {
        $c = $this->gerer($request, $type, $id);
        if ($c->statut_contenu === 'publie') {
            return response()->json(['message' => 'Ce contenu est déjà publié.'], 422);
        }
        if ($c->date_expiration && $c->date_expiration->lt(today())) { // RG23
            return response()->json(['message' => "La date d'expiration est dépassée."], 422);
        }
        $c->update([
    'statut_contenu' => 'publie',
    'date_publication' => $c->date_publication ?? now(),
]);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true));
    }

    public function archiver(Request $request, string $type, int $id): JsonResponse
    {
        $c = $this->gerer($request, $type, $id);
        if ($c->statut_contenu !== 'publie') {
            return response()->json(['message' => 'Seul un contenu publié peut être archivé.'], 422);
        }
        $c->update(['statut_contenu' => 'archive']);

        return response()->json($this->formater($c->load('auteur:id,nom,prenom'), true));
    }

    public function destroy(Request $request, string $type, int $id): JsonResponse
    {
        $c = $this->gerer($request, $type, $id);
        $fichiers = $c->images()->pluck('fichier')->all();
        $c->delete(); // les lignes images partent en cascade
        Storage::disk('local')->delete($fichiers);

        return response()->json(['message' => 'Contenu supprimé.']);
    }

    // Permission de publication (RG11), 404 hors entreprise (RG05), portée du Manager (RG21)
    private function gerer(Request $request, string $type, int $id): Contenu
    {
        $u = $request->user();
        if (! $this->acces->autorise($u, $type, 'publier')) {
            abort(403, 'Action non autorisée.');
        }
        $c = Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', $type)->findOrFail($id);
        if (! $this->acces->peutCibler($u, $c->visibilite, $c->departement_id)) {
            abort(403, 'Un Manager ne gère que les contenus de son département.');
        }

        return $c;
    }

    // Contenus de l'entreprise, destinés à tous, à mon département, ou que j'ai écrits (RG05, RG22)
    private function visibles(Utilisateur $u, string $type): Builder
    {
        return Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', $type)
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            });
    }

    // RG23 : une annonce n'est plus affichée après sa date d'expiration
    private function sansExpirees(Builder $requete): void
    {
        $requete->where(fn ($q) => $q->whereNull('date_expiration')
            ->orWhere('date_expiration', '>=', today()->toDateString()));
    }

    private function formater(Contenu $c, bool $complet): array
    {
        $r = [
            'id' => $c->id,
            'type_contenu' => $c->type_contenu,
            'titre' => $c->titre,
            'categorie' => $c->categorie,
            'statut_contenu' => $c->statut_contenu,
            'visibilite' => $c->visibilite,
            'departement_id' => $c->departement_id,
            'date_publication' => $c->date_publication,
            'date_expiration' => $c->date_expiration?->toDateString(),
            'numero_note' => $c->numero_note,
            'auteur' => $c->auteur ? $c->auteur->only(['id', 'nom', 'prenom']) : null,
        ];
        $r[$complet ? 'corps' : 'extrait'] = $complet ? $c->corps : Str::limit($c->corps, 150);
        if ($complet) {
            $r['images'] = $c->images->map(fn ($i) => PageImageController::formater($i))->values()->all();
        }

        return $r;
    }
}

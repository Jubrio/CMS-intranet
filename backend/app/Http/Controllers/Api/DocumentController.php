<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerDocumentRequest;
use App\Models\Document;
use App\Models\Utilisateur;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class DocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['q' => 'nullable|string|max:100', 'categorie' => 'nullable|string|max:50']);

        $requete = $this->visibles($request->user());
        if ($q = trim((string) $request->query('q'))) {
            $requete->where('nom_document', 'ilike', '%' . addcslashes($q, '%_\\') . '%');
        }
        if ($request->filled('categorie')) {
            $requete->where('categorie', $request->query('categorie'));
        }

        $page = $requete->with('auteur:id,nom,prenom')->orderByDesc('id')->paginate(20);

        return response()->json($page->through(fn ($d) => $this->formater($d)));
    }

    public function categories(Request $request): JsonResponse
    {
        return response()->json(
            $this->visibles($request->user())->distinct()->orderBy('categorie')->pluck('categorie')
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $d = $this->visibles($request->user())->with('auteur:id,nom,prenom')->findOrFail($id);

        return response()->json($this->formater($d));
    }

    // Adresse de téléchargement signée et de courte durée, remise seulement à qui voit le document (RG26).
    // Le navigateur la télécharge directement : pas d'appel inter-origines, donc pas de souci CORS.
    public function lien(Request $request, int $id): JsonResponse
    {
        $d = $this->visibles($request->user())->findOrFail($id);

        return response()->json([
            'url' => URL::temporarySignedRoute('documents.fichier', now()->addMinutes(5), ['id' => $d->id]),
        ]);
    }

    // Fichier du document. Route HORS authentification : l'accès est contrôlé par la signature de l'adresse.
    public function fichier(Request $request, int $id)
    {
        return $this->envoyer(Document::findOrFail($id));
    }

    // Téléchargement direct avec jeton (clients qui peuvent envoyer l'en-tête Authorization)
    public function telecharger(Request $request, int $id)
    {
        return $this->envoyer($this->visibles($request->user())->findOrFail($id));
    }

    private function envoyer(Document $d)
    {
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disque */
        $disque = Storage::disk('local');
        abort_unless($disque->exists($d->fichier), 404);

        // Nom proposé : celui du document + l'extension du fichier, sans caractère interdit dans un en-tête
        $nom = trim(preg_replace('/[\/\\\\"\x00-\x1F\x7F]+/', '-', $d->nom_document), " .-");
        $extension = pathinfo($d->fichier, PATHINFO_EXTENSION);

        return $disque->download($d->fichier, ($nom !== '' ? $nom : 'document') . ($extension !== '' ? '.' . $extension : ''), [
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function store(EnregistrerDocumentRequest $request): JsonResponse
    {
        $u = $request->user();
        $d = $request->validated();
        $fichier = $request->file('fichier');

        $nom = $d['nom_document'] ?? pathinfo($fichier->getClientOriginalName(), PATHINFO_FILENAME);
        $mime = $fichier->getMimeType();
        $taille = (int) ceil($fichier->getSize() / 1024);
        $chemin = $fichier->store('documents/' . $u->entreprise_id, 'local');

        $doc = Document::create([
            'entreprise_id' => $u->entreprise_id, // RG05
            'auteur_id' => $u->id,
            'departement_id' => $d['visibilite'] === 'departement' ? $d['departement_id'] : null,
            'nom_document' => Str::limit($nom, 150, ''),
            'fichier' => $chemin,
            'type_mime' => $mime,
            'taille_fichier' => $taille,
            'categorie' => $d['categorie'],
            'visibilite' => $d['visibilite'],
        ]);

        return response()->json($this->formater($doc->load('auteur:id,nom,prenom')), 201);
    }

    public function update(EnregistrerDocumentRequest $request, int $id): JsonResponse
    {
        $doc = Document::where('entreprise_id', $request->user()->entreprise_id)->findOrFail($id);
        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        $visibilite = $d['visibilite'] ?? $doc->visibilite;
        $dept = array_key_exists('departement_id', $d) ? $d['departement_id'] : $doc->departement_id;
        if ($visibilite === 'entreprise') {
            $dept = null;
        }
        if ($visibilite === 'departement' && ! $dept) {
            return response()->json(['message' => 'Un département est requis.',
                'errors' => ['departement_id' => ['Un département est requis.']]], 422);
        }

        $doc->update(Arr::only($d, ['nom_document', 'categorie']) + ['visibilite' => $visibilite, 'departement_id' => $dept]);

        return response()->json($this->formater($doc->load('auteur:id,nom,prenom')));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $doc = Document::where('entreprise_id', $request->user()->entreprise_id)->findOrFail($id);
        Storage::disk('local')->delete($doc->fichier);
        $doc->delete();

        return response()->json(['message' => 'Document supprimé.']);
    }

    // Documents de l'entreprise, destinés à tous, à mon département, ou que j'ai déposés (RG05, RG26)
    private function visibles(Utilisateur $u): Builder
    {
        return Document::where('entreprise_id', $u->entreprise_id)
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            });
    }

    private function formater(Document $d): array
    {
        return [
            'id' => $d->id,
            'nom_document' => $d->nom_document,
            'categorie' => $d->categorie,
            'visibilite' => $d->visibilite,
            'departement_id' => $d->departement_id,
            'type_mime' => $d->type_mime,
            'taille_fichier' => $d->taille_fichier,
            'auteur' => $d->auteur ? $d->auteur->only(['id', 'nom', 'prenom']) : null,
            'created_at' => $d->created_at,
        ];
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerImagePageRequest;
use App\Models\Contenu;
use App\Models\Image;
use App\Services\AccesContenus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Images des actualités, annonces et articles (affichées dans le fil d'accueil).
// Même table, mêmes fichiers privés et mêmes adresses signées que les images des pages :
// le fichier est servi par la route images.fichier.
class ContenuImageController extends Controller
{
    private const MAX_IMAGES = 6; // par contenu

    public function __construct(private AccesContenus $acces)
    {
    }

    public function store(EnregistrerImagePageRequest $request, string $type, int $id): JsonResponse
    {
        $u = $request->user();
        $contenu = $this->contenu($request, $type, $id);

        if ($contenu->images()->count() >= self::MAX_IMAGES) {
            return response()->json(['message' => 'Limite de ' . self::MAX_IMAGES . ' images par publication atteinte.'], 422);
        }

        $fichier = $request->file('image');
        $nom = Str::limit(pathinfo($fichier->getClientOriginalName(), PATHINFO_FILENAME), 150, '');
        $mime = $fichier->getMimeType();
        $taille = (int) ceil($fichier->getSize() / 1024);
        // disque privé, nom aléatoire : jamais le nom envoyé par l'utilisateur
        $chemin = $fichier->store('contenus/' . $u->entreprise_id, 'local');

        $image = Image::create([
            'entreprise_id' => $u->entreprise_id, // RG05
            'contenu_id' => $contenu->id,
            'auteur_id' => $u->id,
            'nom_image' => $nom,
            'texte_alternatif' => $request->validated()['texte_alternatif'] ?? null,
            'fichier' => $chemin,
            'type_mime' => $mime,
            'taille_fichier' => $taille,
        ]);

        return response()->json(PageImageController::formater($image), 201);
    }

    public function destroy(Request $request, string $type, int $id, int $imageId): JsonResponse
    {
        $contenu = $this->contenu($request, $type, $id);
        $image = $contenu->images()->findOrFail($imageId); // 404 si l'image n'est pas de ce contenu

        $chemin = $image->fichier;
        $image->delete();
        Storage::disk('local')->delete($chemin);

        return response()->json(['message' => 'Image supprimée.']);
    }

    // Mêmes règles que la modification d'un contenu : droit de publication (RG11),
    // contenu de l'entreprise (RG05), portée du Manager (RG21)
    private function contenu(Request $request, string $type, int $id): Contenu
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
}

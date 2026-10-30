<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerImagePageRequest;
use App\Models\Contenu;
use App\Models\Image;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class PageImageController extends Controller
{
    private const MAX_IMAGES = 10;

    private const VALIDITE_URL_MINUTES = 60;

    public function store(EnregistrerImagePageRequest $request, int $id): JsonResponse
    {
        $u = $request->user();
        $page = $this->page($request, $id);

        if ($page->images()->count() >= self::MAX_IMAGES) {
            return response()->json(['message' => 'Limite de '.self::MAX_IMAGES.' images par page atteinte.'], 422);
        }

        $fichier = $request->file('image');
        $nom = Str::limit(pathinfo($fichier->getClientOriginalName(), PATHINFO_FILENAME), 150, '');
        $mime = $fichier->getMimeType();
        $taille = (int) ceil($fichier->getSize() / 1024);
        $chemin = $fichier->store('pages/'.$u->entreprise_id, 'local');

        $image = Image::create([
            'entreprise_id' => $u->entreprise_id,
            'contenu_id' => $page->id,
            'auteur_id' => $u->id,
            'nom_image' => $nom,
            'texte_alternatif' => $request->validated()['texte_alternatif'] ?? null,
            'fichier' => $chemin,
            'type_mime' => $mime,
            'taille_fichier' => $taille,
        ]);

        return response()->json(self::formater($image), 201);
    }

    public function destroy(Request $request, int $id, int $imageId): JsonResponse
    {
        $page = $this->page($request, $id);
        $image = $page->images()->findOrFail($imageId);
        $chemin = $image->fichier;
        $image->delete();
        Storage::disk('local')->delete($chemin);

        return response()->json(['message' => 'Image supprimée.']);
    }

    public function fichier(Request $request, int $id)
    {
        $image = Image::findOrFail($id);

        /** @var FilesystemAdapter $disque */
        $disque = Storage::disk('local');
        abort_unless($disque->exists($image->fichier), 404);

        return $disque->response($image->fichier, null, [
            'Content-Type' => $image->type_mime,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Cache-Control' => 'private, max-age=3600',
        ], 'inline');
    }

    public static function formater(Image $i): array
    {
        return [
            'id' => $i->id,
            'nom_image' => $i->nom_image,
            'texte_alternatif' => $i->texte_alternatif,
            'type_mime' => $i->type_mime,
            'taille_ko' => $i->taille_fichier,
            'url' => URL::temporarySignedRoute(
                'images.fichier',
                now()->addMinutes(self::VALIDITE_URL_MINUTES),
                ['id' => $i->id]
            ),
        ];
    }

    private function page(Request $request, int $id): Contenu
    {
        return Contenu::where('entreprise_id', $request->user()->entreprise_id)
            ->where('type_contenu', 'page')->findOrFail($id);
    }
}

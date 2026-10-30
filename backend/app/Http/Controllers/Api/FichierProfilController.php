<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FichiersProfil;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

// Photos de profil et logos. Route HORS authentification : l'accès est contrôlé par la signature de l'adresse.
class FichierProfilController extends Controller
{
    public function fichier(Request $request, string $chemin)
    {
        /** @var FilesystemAdapter $disque */
        $disque = Storage::disk(FichiersProfil::DISQUE);
        // Anciens fichiers, enregistrés avant le passage au disque privé
        if (! $disque->exists($chemin)) {
            $disque = Storage::disk('public');
        }
        abort_unless($disque->exists($chemin), 404);

        return $disque->response($chemin, null, [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Cache-Control' => 'private, max-age=3600',
        ], 'inline');
    }

    // Supprime un fichier, qu'il soit sur le disque privé ou sur l'ancien disque public
    public static function supprimer(string $chemin): void
    {
        Storage::disk(FichiersProfil::DISQUE)->delete($chemin);
        Storage::disk('public')->delete($chemin);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FichiersProfil;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FichierProfilController extends Controller
{
    public function fichier(Request $request, string $chemin)
    {
        /** @var FilesystemAdapter $disque */
        $disque = Storage::disk(FichiersProfil::DISQUE);
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

    public static function supprimer(string $chemin): void
    {
        Storage::disk(FichiersProfil::DISQUE)->delete($chemin);
        Storage::disk('public')->delete($chemin);
    }
}

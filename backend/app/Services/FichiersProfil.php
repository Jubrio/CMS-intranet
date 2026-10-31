<?php

namespace App\Services;

use Illuminate\Support\Facades\URL;

class FichiersProfil
{
    public const DISQUE = 'fichiers';

    private const VALIDITE_HEURES = 2;

    public static function url(?string $chemin): ?string
    {
        if (blank($chemin)) {
            return null;
        }

        return URL::temporarySignedRoute(
            'profil.fichier',
            now()->startOfHour()->addHours(self::VALIDITE_HEURES),
            ['chemin' => $chemin]
        );
    }
}

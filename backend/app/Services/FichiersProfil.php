<?php

namespace App\Services;

use Illuminate\Support\Facades\URL;

// Photos de profil et logos : stockés sur le disque privé « local » et remis par adresse signée
// (même principe que les images de contenu). Le chemin relatif reste ce qui est enregistré en base.
class FichiersProfil
{
    public const DISQUE = 'local';

    // Les adresses sont valables 2 à 3 h et identiques pendant une heure (cache navigateur efficace)
    private const VALIDITE_HEURES = 2;

    // Adresse signée d'un fichier (« photos/abc.jpg », « logos/3/abc.png »), ou null s'il n'y en a pas
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

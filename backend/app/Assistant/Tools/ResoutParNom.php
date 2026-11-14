<?php

namespace App\Assistant\Tools;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/** Retrouve un rôle, un département... à partir du nom donné par le modèle, sans tenir compte de la casse ni des accents. */
trait ResoutParNom
{
    private function trouverParNom(Collection $liste, string $colonne, string $nom): ?Model
    {
        $cle = $this->normaliser($nom);

        return $liste->first(fn ($element) => $this->normaliser($element->{$colonne}) === $cle);
    }

    private function normaliser(string $texte): string
    {
        return Str::lower(Str::ascii(trim($texte)));
    }
}

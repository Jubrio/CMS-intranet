<?php

namespace App\Assistant\Tools;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Retrouve un élément par son identifiant, ou à défaut par son titre actuel (exact, puis partiel).
 * Évite au modèle de devoir enchaîner « lister puis agir ».
 */
trait RechercheParTitre
{
    /**
     * @param  Builder  $requete  requête déjà limitée à l'entreprise (et au type éventuel)
     * @param  string  $colonne  colonne contenant le titre
     * @param  string  $aucun  début du message d'absence, ex. « Aucun événement »
     * @param  string  $outilListe  nom de l'outil de liste, ex. lister_evenements
     */
    private function retrouverParTitre(Builder $requete, ?int $id, ?string $titre, string $colonne, string $aucun, string $outilListe): Model
    {
        if ($id) {
            $element = (clone $requete)->find($id);
            if (! $element) {
                throw new ToolException("{$aucun} avec l'identifiant {$id}. Appelle toi-même {$outilListe} pour retrouver le bon identifiant, ou utilise le titre exact.");
            }

            return $element;
        }

        $titre = trim((string) $titre);
        if ($titre === '') {
            throw new ToolException('Indiquez le titre actuel (ou l\'identifiant).');
        }

        $norme = fn (?string $t) => Str::lower(Str::ascii(trim((string) $t)));
        $cle = $norme($titre);
        $tous = (clone $requete)->orderByDesc('id')->get();

        $candidats = $tous->filter(fn ($e) => $norme($e->{$colonne}) === $cle);
        if ($candidats->isEmpty()) {
            $candidats = $tous->filter(fn ($e) => $norme($e->{$colonne}) !== ''
                && (str_contains($norme($e->{$colonne}), $cle) || str_contains($cle, $norme($e->{$colonne}))));
        }

        if ($candidats->isEmpty()) {
            throw new ToolException("{$aucun} intitulé « {$titre} ». Appelle toi-même {$outilListe} pour voir les titres existants.");
        }
        if ($candidats->count() > 1) {
            $liste = $candidats->take(6)->map(fn ($e) => "« {$e->{$colonne}} » (identifiant {$e->id})")->implode(', ');
            throw new ToolException("Plusieurs éléments correspondent : {$liste}. Demande à l'administrateur lequel choisir, puis utilise son identifiant.");
        }

        return $candidats->first();
    }
}

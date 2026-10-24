<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;

// Anniversaires d'embauche à venir, partagés par les tableaux de bord RH et Manager.
class AnniversairesEmbauche
{
    // Comptes dont la date d'embauche tombe (au moins 1 an après) dans les $horizonJours prochains jours
    public function prochains(Collection $utilisateurs, Carbon $aujourdhui, int $horizonJours, int $limite): array
    {
        $fin = $aujourdhui->copy()->addDays($horizonJours);

        return $utilisateurs->filter(fn ($u) => $u->date_embauche !== null)
            ->map(function ($u) use ($aujourdhui) {
                $prochain = $u->date_embauche->copy()->year($aujourdhui->year);
                if ($prochain->lt($aujourdhui)) {
                    $prochain->addYear();
                }

                return ['u' => $u, 'date' => $prochain, 'annees' => $prochain->year - $u->date_embauche->year];
            })
            ->filter(fn ($a) => $a['annees'] >= 1 && $a['date']->lte($fin))
            ->sortBy(fn ($a) => $a['date']->timestamp)
            ->take($limite)
            ->map(fn ($a) => [
                'id' => $a['u']->id,
                'nom' => $a['u']->nom,
                'prenom' => $a['u']->prenom,
                'poste' => $a['u']->poste,
                'date' => $a['date']->toDateString(),
                'annees' => $a['annees'],
            ])->values()->all();
    }
}

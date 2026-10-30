<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class HierarchieUtilisateurs
{
    public function creeUnCycle(int $utilisateurId, ?int $superieurId): bool
    {
        $courant = $superieurId;
        $vus = [];
        while ($courant) {
            if ($courant === $utilisateurId || isset($vus[$courant])) {
                return true;
            }
            $vus[$courant] = true;
            $courant = (int) DB::table('utilisateurs')->where('id', $courant)->value('superieur_id');
        }

        return false;
    }
}

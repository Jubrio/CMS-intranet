<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Aides pour les outils des modules (événements, FAQ...) : module actif + permissions, comme les routes. */
trait OutilsModules
{
    private function moduleActif(Utilisateur $utilisateur, string $code): bool
    {
        return DB::table('modules_entreprise')
            ->join('modules', 'modules.id', '=', 'modules_entreprise.module_id')
            ->where('modules_entreprise.entreprise_id', $utilisateur->entreprise_id)
            ->where('modules_entreprise.module_actif', true)
            ->where('modules.code_module', $code)
            ->exists();
    }

    private function droitsModules(Utilisateur $utilisateur, array $modules, array $permissions): bool
    {
        foreach ($modules as $module) {
            if (! $this->moduleActif($utilisateur, $module)) {
                return false;
            }
        }
        $detenues = $utilisateur->role->permissions()->pluck('code_permission');

        return collect($permissions)->every(fn ($p) => $detenues->contains($p));
    }

    /** « 2026-12-25 » ou « 2026-12-25 14:30 ». Une date seule vaut 00:00 au début et 23:59 à la fin. */
    private function lireDate(string $texte, bool $fin): Carbon
    {
        $texte = trim($texte);
        try {
            $date = Carbon::parse($texte);
        } catch (\Throwable) {
            throw new ToolException("Date « {$texte} » invalide : utilisez le format AAAA-MM-JJ ou AAAA-MM-JJ HH:MM.");
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $texte)) {
            return $fin ? $date->setTime(23, 59) : $date->startOfDay();
        }

        return $date;
    }
}

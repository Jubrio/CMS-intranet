<?php

namespace App\Assistant\Tools;

use App\Models\Utilisateur;
use Illuminate\Support\Str;

/** Aides communes aux outils qui agissent sur les comptes et les départements. */
trait OutilsOrganisation
{
    private function aPermission(Utilisateur $utilisateur, string $code): bool
    {
        return $utilisateur->role->permissions()->where('code_permission', $code)->exists();
    }

    /** Les personnes sont désignées par leur e-mail (unique) : jamais de confusion entre deux homonymes. */
    private function trouverUtilisateur(Utilisateur $appelant, string $email): Utilisateur
    {
        $trouve = Utilisateur::with('role')
            ->where('entreprise_id', $appelant->entreprise_id)
            ->whereRaw('lower(email) = ?', [Str::lower(trim($email))])
            ->first();

        return $trouve ?? throw new ToolException("Aucun compte avec l'adresse « {$email} » dans votre entreprise.");
    }

    /** « aucun », « aucune »... : le modèle veut vider un champ. */
    private function estAucun(string $valeur): bool
    {
        return in_array(Str::lower(Str::ascii(trim($valeur))), ['aucun', 'aucune', 'vide', 'sans', 'none', 'null', '-'], true);
    }

    /** Retire les paramètres absents ou vides envoyés par le modèle. */
    private function renseignes(array $params): array
    {
        return array_filter($params, fn ($v) => $v !== null && $v !== '' && $v !== []);
    }

    private function nomComplet(Utilisateur $u): string
    {
        return trim($u->prenom.' '.$u->nom);
    }
}

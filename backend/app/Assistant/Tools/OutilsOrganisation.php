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

    /**
     * Une personne est désignée par son e-mail (unique) ou, à défaut, par son nom complet.
     * Plusieurs homonymes : on renvoie leurs e-mails pour que l'administrateur choisisse, jamais de choix au hasard.
     */
    private function trouverUtilisateur(Utilisateur $appelant, string $saisie): Utilisateur
    {
        $saisie = trim($saisie);
        $base = Utilisateur::with('role')->where('entreprise_id', $appelant->entreprise_id);

        if (str_contains($saisie, '@')) {
            return $base->whereRaw('lower(email) = ?', [Str::lower($saisie)])->first()
                ?? throw new ToolException("Aucun compte avec l'adresse « {$saisie} » dans votre entreprise. Appelle toi-même lister_utilisateurs pour retrouver le bon e-mail.");
        }

        $norme = fn (string $t) => Str::lower(Str::ascii(trim(preg_replace('/\s+/', ' ', $t))));
        $cle = $norme($saisie);
        if ($cle === '') {
            throw new ToolException("Indiquez l'e-mail ou le nom complet de la personne.");
        }

        $tous = $base->get();
        $candidats = $tous->filter(fn ($u) => in_array($cle, [$norme($u->prenom.' '.$u->nom), $norme($u->nom.' '.$u->prenom)], true));
        if ($candidats->isEmpty()) {
            $mots = array_filter(explode(' ', $cle));
            $candidats = $tous->filter(function ($u) use ($norme, $mots) {
                $texte = $norme($u->prenom.' '.$u->nom);
                foreach ($mots as $mot) {
                    if (! str_contains($texte, $mot)) {
                        return false;
                    }
                }

                return true;
            });
        }

        if ($candidats->isEmpty()) {
            throw new ToolException("Aucun compte nommé « {$saisie} » dans votre entreprise. Appelle toi-même lister_utilisateurs pour vérifier, sans inventer d'e-mail.");
        }
        if ($candidats->count() > 1) {
            $liste = $candidats->take(6)->map(fn ($u) => $this->nomComplet($u).' ('.$u->email.')')->implode(', ');
            throw new ToolException("Plusieurs comptes correspondent : {$liste}. Demande à l'administrateur lequel choisir, puis utilise son e-mail.");
        }

        return $candidats->first();
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

<?php

namespace App\Services;

use App\Models\JournalOperation;
use App\Models\Utilisateur;

class JournalOperations
{
    public static function enregistrer(
        ?Utilisateur $auteur,
        string $action,
        string $cibleType,
        ?int $cibleId,
        ?string $cibleLibelle,
        array $details = [],
    ): JournalOperation {
        return JournalOperation::create([
            'utilisateur_id' => $auteur?->id,
            'utilisateur_libelle' => $auteur ? trim($auteur->prenom.' '.$auteur->nom) : null,
            'action' => $action,
            'cible_type' => $cibleType,
            'cible_id' => $cibleId,
            'cible_libelle' => $cibleLibelle,
            'details' => $details ?: null,
            // Horodatage fixé en UTC par l'application, pas par le fuseau du serveur de base de données.
            'created_at' => now('UTC'),
        ]);
    }
}

<?php

namespace App\Assistant\Tools;

use App\Models\Departement;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use Illuminate\Support\Str;

/** Résolution des destinataires (toute l'entreprise ou un département) pour pages, documents, etc. */
trait OutilsPortee
{
    use ResoutParNom;

    /**
     * @return array{0: string, 1: ?int, 2: string} visibilité, id du département, nom canonique (« aucun » pour toute l'entreprise)
     */
    private function resoudreDestinataires(Utilisateur $utilisateur, ?string $nom): array
    {
        if ($nom === null || in_array(Str::lower(Str::ascii(trim($nom))), ['aucun', 'aucune', 'entreprise', 'tous', 'toute l\'entreprise', 'toute entreprise'], true)) {
            return ['entreprise', null, 'aucun'];
        }
        $departements = Departement::where('entreprise_id', $utilisateur->entreprise_id)->get();
        $departement = $this->trouverParNom($departements, 'nom_departement', $nom);
        if (! $departement) {
            throw new ToolException("Département « {$nom} » introuvable. Départements disponibles : "
                .($departements->pluck('nom_departement')->implode(', ') ?: 'aucun').'.');
        }

        return ['departement', $departement->id, $departement->nom_departement];
    }

    private function verifierPorteeManager(Utilisateur $utilisateur, string $visibilite, ?int $departementId, string $objet): void
    {
        if (! app(AccesContenus::class)->peutCibler($utilisateur, $visibilite, $departementId)) {
            throw new ToolException("Un Manager ne gère que les {$objet} de son département.");
        }
    }
}

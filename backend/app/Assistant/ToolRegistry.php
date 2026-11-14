<?php

namespace App\Assistant;

use App\Assistant\Tools\CreerUtilisateurTool;
use App\Assistant\Tools\ToolInterface;
use App\Models\Utilisateur;

/**
 * Liste des outils de l'assistant. Pour en ajouter un : créer la classe dans Tools/,
 * puis l'injecter ici et l'ajouter au tableau du constructeur.
 */
class ToolRegistry
{
    /** @var array<string, ToolInterface> */
    private array $outils = [];

    public function __construct(CreerUtilisateurTool $creerUtilisateur)
    {
        foreach ([$creerUtilisateur] as $outil) {
            $this->outils[$outil->name()] = $outil;
        }
    }

    public function trouver(string $nom): ?ToolInterface
    {
        return $this->outils[$nom] ?? null;
    }

    /** Schémas des seuls outils que cet utilisateur a le droit d'utiliser : le modèle ne voit pas les autres. */
    public function schemasPour(Utilisateur $utilisateur): array
    {
        return collect($this->outils)
            ->filter(fn (ToolInterface $outil) => $outil->authorize($utilisateur))
            ->map(fn (ToolInterface $outil) => $outil->schema())
            ->values()
            ->all();
    }
}

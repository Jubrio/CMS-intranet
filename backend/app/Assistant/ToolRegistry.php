<?php

namespace App\Assistant;

use App\Assistant\Tools\ChangerStatutContenuTool;
use App\Assistant\Tools\ChangerStatutUtilisateurTool;
use App\Assistant\Tools\CreerDepartementTool;
use App\Assistant\Tools\CreerEvenementTool;
use App\Assistant\Tools\CreerQuestionFaqTool;
use App\Assistant\Tools\CreerUtilisateurTool;
use App\Assistant\Tools\ListerContenusTool;
use App\Assistant\Tools\ListerDepartementsTool;
use App\Assistant\Tools\ListerEvenementsTool;
use App\Assistant\Tools\ListerFaqTool;
use App\Assistant\Tools\ListerUtilisateursTool;
use App\Assistant\Tools\ModifierContenuTool;
use App\Assistant\Tools\ModifierDepartementTool;
use App\Assistant\Tools\ModifierEvenementTool;
use App\Assistant\Tools\ModifierQuestionFaqTool;
use App\Assistant\Tools\ModifierUtilisateurTool;
use App\Assistant\Tools\PublierContenuTool;
use App\Assistant\Tools\ReinitialiserMotDePasseTool;
use App\Assistant\Tools\ListerPagesTool;
use App\Assistant\Tools\CreerPageTool;
use App\Assistant\Tools\ModifierPageTool;
use App\Assistant\Tools\ChangerStatutPageTool;
use App\Assistant\Tools\ListerDocumentsTool;
use App\Assistant\Tools\ModifierDocumentTool;
use App\Assistant\Tools\ListerFormulairesTool;
use App\Assistant\Tools\ChangerStatutFormulaireTool;
use App\Assistant\Tools\ToolInterface;
use App\Models\Utilisateur;

/**
 * Liste des outils de l'assistant. Pour en ajouter un : créer la classe dans Tools/ et l'ajouter à OUTILS.
 */
class ToolRegistry
{
    private const OUTILS = [
        CreerUtilisateurTool::class,
        ModifierUtilisateurTool::class,
        ChangerStatutUtilisateurTool::class,
        ReinitialiserMotDePasseTool::class,
        CreerDepartementTool::class,
        ModifierDepartementTool::class,
        ListerUtilisateursTool::class,
        ListerDepartementsTool::class,
        PublierContenuTool::class,
        ListerContenusTool::class,
        ModifierContenuTool::class,
        ChangerStatutContenuTool::class,
        ListerEvenementsTool::class,
        CreerEvenementTool::class,
        ModifierEvenementTool::class,
        ListerFaqTool::class,
        CreerQuestionFaqTool::class,
        ModifierQuestionFaqTool::class,
        ListerPagesTool::class,
        CreerPageTool::class,
        ModifierPageTool::class,
        ChangerStatutPageTool::class,
        ListerDocumentsTool::class,
        ModifierDocumentTool::class,
        ListerFormulairesTool::class,
        ChangerStatutFormulaireTool::class,
    ];

    /** @var array<string, ToolInterface> */
    private array $outils = [];

    public function __construct()
    {
        foreach (self::OUTILS as $classe) {
            $outil = app($classe);
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

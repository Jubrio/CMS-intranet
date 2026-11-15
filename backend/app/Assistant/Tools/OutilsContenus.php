<?php

namespace App\Assistant\Tools;

use App\Models\Contenu;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use Illuminate\Support\Str;

/** Aides communes aux outils qui lisent ou gèrent des contenus existants. */
trait OutilsContenus
{
    /** Types gérables par l'assistant (les pages internes restent hors périmètre). */
    private const TYPES_CONTENU = ['actualite', 'annonce', 'article', 'note_service'];

    private const LIBELLES_CONTENU = [
        'actualite' => 'actualité', 'annonce' => 'annonce', 'article' => 'article', 'note_service' => 'note de service',
    ];

    private function acces(): AccesContenus
    {
        return app(AccesContenus::class);
    }

    private function peutSurAuMoinsUnType(Utilisateur $utilisateur, string $action): bool
    {
        foreach (self::TYPES_CONTENU as $type) {
            if ($this->acces()->autorise($utilisateur, $type, $action)) {
                return true;
            }
        }

        return false;
    }

    /** Trouve un contenu de l'entreprise et vérifie les mêmes droits que ContenuController::gerer(). */
    private function contenuAGerer(Utilisateur $utilisateur, string $type, int $id): Contenu
    {
        if (! $this->acces()->autorise($utilisateur, $type, 'publier')) {
            throw new ToolException('Vous ne pouvez pas gérer de '.self::LIBELLES_CONTENU[$type].' : module désactivé ou droit manquant.');
        }
        $contenu = Contenu::where('entreprise_id', $utilisateur->entreprise_id)
            ->where('type_contenu', $type)->find($id);
        if (! $contenu) {
            throw new ToolException('Aucune '.self::LIBELLES_CONTENU[$type]." avec l'identifiant {$id}. Appelle toi-même lister_contenus pour retrouver le bon identifiant, ou utilise le titre exact.");
        }
        if (! $this->acces()->peutCibler($utilisateur, $contenu->visibilite, $contenu->departement_id)) {
            throw new ToolException('Un Manager ne gère que les contenus de son département.');
        }

        return $contenu;
    }

    /**
     * Retrouve un contenu par son identifiant, ou à défaut par son titre actuel (exact, puis partiel).
     * Plusieurs correspondances : on renvoie la liste pour que l'administrateur précise.
     */
    private function trouverContenuGerable(Utilisateur $utilisateur, string $type, ?int $id, ?string $titreActuel): Contenu
    {
        if ($id) {
            return $this->contenuAGerer($utilisateur, $type, $id);
        }
        $titreActuel = trim((string) $titreActuel);
        if ($titreActuel === '') {
            throw new ToolException("Indiquez le titre actuel du contenu (ou son identifiant).");
        }
        if (! $this->acces()->autorise($utilisateur, $type, 'publier')) {
            throw new ToolException('Vous ne pouvez pas gérer de '.self::LIBELLES_CONTENU[$type].' : module désactivé ou droit manquant.');
        }

        $norme = fn (string $t) => Str::lower(Str::ascii(trim($t)));
        $cle = $norme($titreActuel);
        $tous = Contenu::where('entreprise_id', $utilisateur->entreprise_id)->where('type_contenu', $type)
            ->orderByDesc('id')->get(['id', 'titre', 'statut_contenu']);

        $candidats = $tous->filter(fn ($c) => $norme($c->titre) === $cle);
        if ($candidats->isEmpty()) {
            $candidats = $tous->filter(fn ($c) => str_contains($norme($c->titre), $cle) || str_contains($cle, $norme($c->titre)));
        }

        if ($candidats->isEmpty()) {
            throw new ToolException("Aucune ".self::LIBELLES_CONTENU[$type]." intitulée « {$titreActuel} ». Appelle toi-même lister_contenus pour voir les titres existants.");
        }
        if ($candidats->count() > 1) {
            $liste = $candidats->take(6)->map(fn ($c) => "« {$c->titre} » (identifiant {$c->id}, {$c->statut_contenu})")->implode(', ');
            throw new ToolException("Plusieurs contenus correspondent : {$liste}. Demande à l'administrateur lequel choisir, puis utilise son identifiant.");
        }

        return $this->contenuAGerer($utilisateur, $type, $candidats->first()->id);
    }
}

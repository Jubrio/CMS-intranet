<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contenu;
use App\Models\LectureNote;
use App\Services\AccesContenus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// Fil d'accueil : les publications que l'utilisateur peut lire (actualités, annonces, articles,
// notes de service), de la plus récente à la plus ancienne, par pages pour le défilement.
// Visibilité : toute l'entreprise, mon département, ou écrit par moi (RG05, RG22).
// Chaque type suit son module et le droit « consulter » du rôle ; une annonce expirée disparaît (RG23).
class FilController extends Controller
{
    private const TYPES = [
        'actualite' => 'Actualités',
        'annonce' => 'Annonces',
        'article' => 'Articles',
        'note_service' => 'Notes de service',
    ];

    private const PAR_PAGE = 10;

    private const LONGUEUR_EXTRAIT = 600;

    public function __invoke(Request $request, AccesContenus $acces): JsonResponse
    {
        $request->validate([
            'type' => 'nullable|in:'.implode(',', array_keys(self::TYPES)),
            'page' => 'nullable|integer|min:1',
        ]);

        $u = $request->user();
        abort_unless($u->entreprise_id, 403, "Réservé aux comptes d'une entreprise.");

        $autorises = array_values(array_filter(
            array_keys(self::TYPES),
            fn ($type) => $acces->autorise($u, $type, 'consulter')
        ));
        $types = array_map(fn ($t) => ['type' => $t, 'libelle' => self::TYPES[$t]], $autorises);

        $demandes = $request->filled('type')
            ? array_values(array_intersect($autorises, [$request->query('type')]))
            : $autorises;

        if ($demandes === []) {
            return response()->json([
                'data' => [], 'current_page' => 1, 'last_page' => 1, 'total' => 0, 'types' => $types,
            ]);
        }

        $page = Contenu::where('entreprise_id', $u->entreprise_id)
            ->whereIn('type_contenu', $demandes)
            ->where('statut_contenu', 'publie')
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            })
            ->where(fn ($q) => $q->where('type_contenu', '!=', 'annonce')
                ->orWhereNull('date_expiration')
                ->orWhere('date_expiration', '>=', today()->toDateString()))
            ->with(['auteur:id,nom,prenom,photo,role_id', 'auteur.role:id,nom_role', 'departement:id,nom_departement', 'images'])
            ->orderByDesc('date_publication')->orderByDesc('id')
            ->paginate(self::PAR_PAGE);

        // Notes de service de la page déjà lues par l'appelant (une seule requête)
        $notes = $page->getCollection()->where('type_contenu', 'note_service')->pluck('id');
        $lues = $notes->isEmpty() ? [] : LectureNote::where('utilisateur_id', $u->id)
            ->whereIn('contenu_id', $notes)->pluck('contenu_id')->all();

        return response()->json([
            'data' => $page->getCollection()->map(fn ($c) => $this->formater($c, $lues))->values()->all(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'types' => $types,
        ]);
    }

    private function formater(Contenu $c, array $lues): array
    {
        $texte = trim(strip_tags((string) $c->corps));
        $tronque = mb_strlen($texte) > self::LONGUEUR_EXTRAIT;

        return [
            'type' => $c->type_contenu,
            'libelle_type' => self::TYPES[$c->type_contenu] ?? $c->type_contenu,
            'id' => $c->id,
            'titre' => $c->titre,
            'categorie' => $c->categorie,
            'numero_note' => $c->numero_note,
            'extrait' => $tronque ? Str::limit($texte, self::LONGUEUR_EXTRAIT) : $texte,
            'tronque' => $tronque,
            'date_publication' => $c->date_publication?->toIso8601String(),
            'date_expiration' => $c->date_expiration?->toDateString(),
            'visibilite' => $c->visibilite,
            'departement' => $c->visibilite === 'departement' ? $c->departement?->nom_departement : null,
            'auteur' => $c->auteur ? [
                'id' => $c->auteur->id,
                'nom' => $c->auteur->nom,
                'prenom' => $c->auteur->prenom,
                'photo' => $c->auteur->photo,
                'role' => $c->auteur->role?->nom_role,
            ] : null,
            'images' => $c->images->map(fn ($i) => PageImageController::formater($i))->values()->all(),
            'lu' => $c->type_contenu === 'note_service' ? in_array($c->id, $lues, true) : null,
        ];
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contenu;
use App\Models\LectureNote;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LectureNoteController extends Controller
{
    public function __construct(private AccesContenus $acces) {}

    // Un destinataire confirme avoir lu une note publiee (RG24). Idempotent.
    public function confirmer(Request $request, int $id): JsonResponse
    {
        $u = $request->user();
        if (! $this->acces->autorise($u, 'note_service', 'consulter')) {
            abort(403, 'Action non autorisée.');
        }

        $note = $this->noteDestinee($u, $id); // 404 si brouillon, archivee, hors public ou hors entreprise

        $cle = ['contenu_id' => $note->id, 'utilisateur_id' => $u->id];
        try {
            $lecture = LectureNote::firstOrCreate($cle, [
                'entreprise_id' => $u->entreprise_id, // RG05
                'date_lecture' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            // deux envois simultanes : la contrainte d'unicite a tranche
            $lecture = LectureNote::where($cle)->firstOrFail();
        }

        return response()->json([
            'message' => 'Lecture confirmée.',
            'contenu_id' => $note->id,
            'date_lecture' => $lecture->date_lecture,
        ], $lecture->wasRecentlyCreated ? 201 : 200);
    }

    // Suivi pour les publicateurs : combien de destinataires, qui a lu et quand
    public function lectures(Request $request, int $id): JsonResponse
    {
        $u = $request->user();
        if (! $this->acces->autorise($u, 'note_service', 'publier')) {
            abort(403, 'Action non autorisée.');
        }

        $note = Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', 'note_service')->findOrFail($id);

        // RG21 : un Manager ne suit que les notes de son departement
        if (! $this->acces->peutCibler($u, $note->visibilite, $note->departement_id)) {
            abort(403, 'Un Manager ne gère que les contenus de son département.');
        }

        $destinataires = Utilisateur::where('entreprise_id', $u->entreprise_id)
            ->where('statut_compte', 'actif');
        if ($note->visibilite === 'departement') {
            $destinataires->where('departement_id', $note->departement_id);
        }

        $lectures = LectureNote::where('contenu_id', $note->id);
        $nbLectures = (clone $lectures)->count();

        $page = $lectures->with('utilisateur:id,nom,prenom')
            ->orderBy('date_lecture')->paginate(50);

        return response()->json([
            'note' => ['id' => $note->id, 'titre' => $note->titre, 'numero_note' => $note->numero_note],
            'nb_destinataires' => $destinataires->count(),
            'nb_lectures' => $nbLectures,
            'lecteurs' => $page->through(fn ($l) => [
                'utilisateur' => $l->utilisateur ? $l->utilisateur->only(['id', 'nom', 'prenom']) : null,
                'date_lecture' => $l->date_lecture,
            ]),
        ]);
    }

    // Note publiee de l'entreprise, destinee a toute l'entreprise ou au departement de l'appelant
    private function noteDestinee(Utilisateur $u, int $id): Contenu
    {
        return Contenu::where('entreprise_id', $u->entreprise_id)
            ->where('type_contenu', 'note_service')
            ->where('statut_contenu', 'publie')
            ->where(function ($w) use ($u) {
                $w->where('visibilite', 'entreprise');
                if ($u->departement_id) {
                    $w->orWhere(fn ($w2) => $w2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            })
            ->findOrFail($id);
    }
}

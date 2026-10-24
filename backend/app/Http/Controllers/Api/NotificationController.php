<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationUtilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Notifications de l'utilisateur connecté. Chaque ligne n'existe que pour ses destinataires :
// un utilisateur ne voit jamais celles d'un département qui n'est pas le sien.
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['non_lues' => 'nullable|boolean']);

        $requete = NotificationUtilisateur::where('utilisateur_id', $request->user()->id);
        if ($request->boolean('non_lues')) {
            $requete->whereNull('lu_at');
        }

        $page = $requete
            ->with(['notification.acteur:id,nom,prenom,photo', 'notification.departement:id,nom_departement'])
            ->orderByDesc('notification_id')
            ->paginate(20);

        return response()->json($page->through(fn ($n) => $this->formater($n)));
    }

    public function nonLues(Request $request): JsonResponse
    {
        return response()->json([
            'non_lues' => NotificationUtilisateur::where('utilisateur_id', $request->user()->id)
                ->whereNull('lu_at')->count(),
        ]);
    }

    public function lire(Request $request, int $id): JsonResponse
    {
        $n = NotificationUtilisateur::where('utilisateur_id', $request->user()->id)->findOrFail($id);
        if ($n->lu_at === null) {
            $n->update(['lu_at' => now()]);
        }

        return response()->json(['message' => 'Notification lue.']);
    }

    public function toutLire(Request $request): JsonResponse
    {
        NotificationUtilisateur::where('utilisateur_id', $request->user()->id)
            ->whereNull('lu_at')->update(['lu_at' => now()]);

        return response()->json(['message' => 'Notifications lues.']);
    }

    private function formater(NotificationUtilisateur $n): array
    {
        $notif = $n->notification;

        return [
            'id' => $n->id,
            'lu' => $n->lu_at !== null,
            'action' => $notif->action,
            'objet_type' => $notif->objet_type,
            'objet_id' => $notif->objet_id,
            'titre' => $notif->titre,
            'departement' => $notif->departement?->nom_departement,
            'acteur' => $notif->acteur ? $notif->acteur->only(['id', 'nom', 'prenom', 'photo']) : null,
            'date' => $notif->created_at?->toIso8601String(),
        ];
    }
}

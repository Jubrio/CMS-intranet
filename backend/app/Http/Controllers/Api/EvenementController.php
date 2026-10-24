<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerEvenementRequest;
use App\Models\Evenement;
use App\Models\Utilisateur;
use App\Services\AccesContenus;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class EvenementController extends Controller
{
    public function __construct(private NotificationService $notifications) {}

    // Vue calendrier : événements qui chevauchent la période demandée (mois courant par défaut)
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'debut' => 'nullable|date',
            'fin' => 'nullable|date|after_or_equal:debut',
        ]);

        $debut = $request->filled('debut') ? Carbon::parse($request->query('debut'))->startOfDay() : now()->startOfMonth();
        $fin = $request->filled('fin') ? Carbon::parse($request->query('fin'))->endOfDay() : now()->endOfMonth();
        if (abs($debut->diffInDays($fin)) > 366) {
            return response()->json(['message' => 'La période ne peut pas dépasser un an.',
                'errors' => ['fin' => ['La période ne peut pas dépasser un an.']]], 422);
        }

        $evenements = $this->visibles($request->user())
            ->where('date_debut', '<=', $fin)
            ->where('date_fin', '>=', $debut)
            ->with('auteur:id,nom,prenom')
            ->orderBy('date_debut')->limit(500)->get();

        return response()->json([
            'debut' => $debut->toDateString(),
            'fin' => $fin->toDateString(),
            'evenements' => $evenements->map(fn ($e) => $this->formater($e)),
        ]);
    }

    // RG21 : un Manager ne gère que les événements de son département
    private function verifierPortee(Utilisateur $u, string $visibilite, $departementId): void
    {
        $dept = $departementId ? (int) $departementId : null;
        if (! app(AccesContenus::class)->peutCibler($u, $visibilite, $dept)) {
            abort(403, 'Un Manager ne gère que les événements de son département.');
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $e = $this->visibles($request->user())->with('auteur:id,nom,prenom')->findOrFail($id);

        return response()->json($this->formater($e));
    }

    public function store(EnregistrerEvenementRequest $request): JsonResponse
    {
        $u = $request->user();
        $d = $request->validated();
        $this->verifierPortee($u, $d['visibilite'], $d['departement_id'] ?? null);

        $e = Evenement::create([
            'entreprise_id' => $u->entreprise_id, // RG05
            'auteur_id' => $u->id,
            'departement_id' => $d['visibilite'] === 'departement' ? $d['departement_id'] : null,
            'titre_evenement' => $d['titre_evenement'],
            'description_evenement' => $d['description_evenement'] ?? null,
            'date_debut' => $d['date_debut'],
            'date_fin' => $d['date_fin'],
            'lieu' => $d['lieu'] ?? null,
            'visibilite' => $d['visibilite'],
        ]);

        // Notifie toute l'entreprise, ou seulement le département ciblé
        $this->notifications->publier($u, 'cree', 'evenement', $e->id, $e->titre_evenement, $e->departement_id);

        return response()->json($this->formater($e->load('auteur:id,nom,prenom')), 201);
    }

    public function update(EnregistrerEvenementRequest $request, int $id): JsonResponse
    {
        $u = $request->user();
        $e = Evenement::where('entreprise_id', $u->entreprise_id)->findOrFail($id);
        $this->verifierPortee($u, $e->visibilite, $e->departement_id); // l'existant

        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }

        $debut = Carbon::parse($d['date_debut'] ?? $e->date_debut);
        $fin = Carbon::parse($d['date_fin'] ?? $e->date_fin);
        if ($fin->lt($debut)) { // RG27
            return response()->json(['message' => 'La date de fin doit être postérieure ou égale à la date de début.',
                'errors' => ['date_fin' => ['La date de fin doit être postérieure ou égale à la date de début.']]], 422);
        }

        $visibilite = $d['visibilite'] ?? $e->visibilite;
        $dept = array_key_exists('departement_id', $d) ? $d['departement_id'] : $e->departement_id;
        if ($visibilite === 'entreprise') {
            $dept = null;
        }
        if ($visibilite === 'departement' && ! $dept) {
            return response()->json(['message' => 'Un département est requis.',
                'errors' => ['departement_id' => ['Un département est requis.']]], 422);
        }
        $this->verifierPortee($u, $visibilite, $dept); // la nouvelle valeur

        $e->update(array_diff_key($d, ['visibilite' => 1, 'departement_id' => 1])
            + ['visibilite' => $visibilite, 'departement_id' => $dept]);

        return response()->json($this->formater($e->load('auteur:id,nom,prenom')));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $u = $request->user();
        $e = Evenement::where('entreprise_id', $u->entreprise_id)->findOrFail($id);
        $this->verifierPortee($u, $e->visibilite, $e->departement_id);
        $e->delete();
        $this->notifications->retirer('evenement', $id);

        return response()->json(['message' => 'Événement annulé.']);
    }

    // Événements de l'entreprise, destinés à tous, à mon département, ou que j'ai créés (RG05)
    private function visibles(Utilisateur $u): Builder
    {
        return Evenement::where('entreprise_id', $u->entreprise_id)
            ->where(function ($q) use ($u) {
                $q->where('visibilite', 'entreprise')->orWhere('auteur_id', $u->id);
                if ($u->departement_id) {
                    $q->orWhere(fn ($q2) => $q2->where('visibilite', 'departement')
                        ->where('departement_id', $u->departement_id));
                }
            });
    }

    private function formater(Evenement $e): array
    {
        return [
            'id' => $e->id,
            'titre_evenement' => $e->titre_evenement,
            'description_evenement' => $e->description_evenement,
            'date_debut' => $e->date_debut->format('Y-m-d H:i:s'),
            'date_fin' => $e->date_fin->format('Y-m-d H:i:s'),
            'lieu' => $e->lieu,
            'visibilite' => $e->visibilite,
            'departement_id' => $e->departement_id,
            'auteur' => $e->auteur ? $e->auteur->only(['id', 'nom', 'prenom']) : null,
        ];
    }
}

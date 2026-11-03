<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Entreprise;
use App\Models\JournalOperation;
use App\Services\JournalOperations;
use App\Services\SuppressionEntreprise;
use App\Models\Module;
use App\Models\ModuleEntreprise;
use App\Models\Utilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SuperIntranetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $requete = Entreprise::query()
            ->withCount([
                'utilisateurs as nb_utilisateurs',
                'utilisateurs as nb_utilisateurs_actifs' => fn ($q) => $q->where('statut_compte', 'actif'),
                'modules as nb_modules_actifs' => fn ($q) => $q->where('module_actif', true),
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('statut')) {
            $requete->where('statut_entreprise', $request->query('statut') === 'suspendue' ? 'suspendue' : 'active');
        }

        if ($request->filled('q')) {
            $q = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $request->query('q')).'%';
            $requete->where(fn ($w) => $w->where('nom_entreprise', 'ilike', $q)
                ->orWhere('slug', 'ilike', $q)
                ->orWhere('email_contact', 'ilike', $q));
        }

        $page = $requete->paginate(15)->through(fn ($e) => $this->formater($e))->toArray();

        $page['totaux'] = [
            'entreprises' => Entreprise::count(),
            'actives' => Entreprise::where('statut_entreprise', 'active')->count(),
            'suspendues' => Entreprise::where('statut_entreprise', 'suspendue')->count(),
            'utilisateurs' => Utilisateur::whereNotNull('entreprise_id')->count(),
        ];

        return response()->json($page);
    }

    public function show(int $id): JsonResponse
    {
        $entreprise = $this->trouver($id);

        $actifs = ModuleEntreprise::where('entreprise_id', $entreprise->id)
            ->where('module_actif', true)->pluck('module_id')->all();

        $modules = Module::orderBy('module_obligatoire', 'desc')->orderBy('nom_module')->get()
            ->map(fn ($m) => [
                'code_module' => $m->code_module,
                'nom_module' => $m->nom_module,
                'module_obligatoire' => $m->module_obligatoire,
                'actif' => in_array($m->id, $actifs, true),
            ])->values();

        $administrateurs = Utilisateur::where('entreprise_id', $entreprise->id)
            ->whereHas('role', fn ($q) => $q->where('nom_role', 'Administrateur'))
            ->orderBy('nom')->orderBy('prenom')
            ->get(['id', 'nom', 'prenom', 'email', 'statut_compte']);

        return response()->json($this->formater($entreprise) + [
            'modules' => $modules,
            'administrateurs' => $administrateurs,
        ]);
    }

    public function changerStatut(Request $request, int $id): JsonResponse
    {
        $donnees = $request->validate([
            'statut' => ['required', Rule::in(['active', 'suspendue'])],
        ], [
            'statut.required' => 'Le statut est obligatoire.',
            'statut.in' => 'Statut invalide.',
        ]);

        $entreprise = $this->trouver($id);
        $ancien = $entreprise->statut_entreprise;

        DB::transaction(function () use ($request, $entreprise, $donnees, $ancien) {
            $entreprise->update(['statut_entreprise' => $donnees['statut']]);
            JournalOperations::enregistrer(
                $request->user(),
                $donnees['statut'] === 'suspendue' ? 'suspendre' : 'reactiver',
                'entreprise',
                $entreprise->id,
                $entreprise->nom_entreprise,
                ['statut_avant' => $ancien, 'statut_apres' => $donnees['statut']],
            );

            if ($donnees['statut'] === 'suspendue') {
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', Utilisateur::class)
                    ->whereIn('tokenable_id', Utilisateur::where('entreprise_id', $entreprise->id)->select('id'))
                    ->delete();
            }
        });

        return response()->json($this->formater($this->trouver($id)));
    }

    /**
     * Supprime définitivement une entreprise et toutes ses données. Opération irréversible :
     * le super-administrateur doit retaper l'adresse (slug) de l'entreprise pour confirmer.
     */
    public function destroy(Request $request, int $id, SuppressionEntreprise $suppression): JsonResponse
    {
        $entreprise = Entreprise::findOrFail($id);

        $request->validate(['confirmation' => ['required', 'string']], [
            'confirmation.required' => "Saisissez l'adresse de l'entreprise pour confirmer la suppression.",
        ]);
        if (! hash_equals($entreprise->slug, (string) $request->input('confirmation'))) {
            return response()->json(['message' => "L'adresse saisie ne correspond pas à celle de l'entreprise."], 422);
        }

        $details = [
            'slug' => $entreprise->slug,
            'nb_utilisateurs' => $entreprise->utilisateurs()->count(),
        ];
        $nom = $entreprise->nom_entreprise;

        $suppression->supprimer($entreprise);
        JournalOperations::enregistrer($request->user(), 'supprimer', 'entreprise', $id, $nom, $details);

        return response()->json(['message' => "L'entreprise « {$nom} » a été supprimée."]);
    }

    /** Journal des opérations effectuées par le super-administrateur sur les entreprises. */
    public function journal(Request $request): JsonResponse
    {
        $requete = JournalOperation::query()->orderByDesc('created_at')->orderByDesc('id');
        if ($request->filled('entreprise_id')) {
            $requete->where('cible_type', 'entreprise')->where('cible_id', (int) $request->query('entreprise_id'));
        }

        return response()->json($requete->paginate(20));
    }

    private function trouver(int $id): Entreprise
    {
        return Entreprise::withCount([
            'utilisateurs as nb_utilisateurs',
            'utilisateurs as nb_utilisateurs_actifs' => fn ($q) => $q->where('statut_compte', 'actif'),
            'modules as nb_modules_actifs' => fn ($q) => $q->where('module_actif', true),
        ])->findOrFail($id);
    }

    private function formater(Entreprise $e): array
    {
        return [
            'id' => $e->id,
            'nom_entreprise' => $e->nom_entreprise,
            'slug' => $e->slug,
            'email_contact' => $e->email_contact,
            'statut_entreprise' => $e->statut_entreprise === 'active' ? 'active' : 'suspendue',
            'created_at' => $e->created_at?->toIso8601String(),
            'nb_utilisateurs' => (int) $e->nb_utilisateurs,
            'nb_utilisateurs_actifs' => (int) $e->nb_utilisateurs_actifs,
            'nb_modules_actifs' => (int) $e->nb_modules_actifs,
        ];
    }
}

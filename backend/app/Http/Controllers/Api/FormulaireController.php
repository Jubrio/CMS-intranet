<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerFormulaireRequest;
use App\Models\Formulaire;
use App\Models\Reponse;
use App\Models\Utilisateur;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FormulaireController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['statut' => 'nullable|in:brouillon,publie,cloture']);
        $u = $request->user();
        $gestionnaire = $this->peutGerer($u);

        if ($request->filled('statut') && ! $gestionnaire) {
            abort(403, 'Action non autorisée.');
        }

        $requete = $this->visibles($u, $gestionnaire);
        if ($request->filled('statut')) {
            $requete->where('statut_formulaire', $request->query('statut'));
        }

        $page = $requete->withCount('reponses')->with('auteur:id,nom,prenom')
            ->orderByDesc('id')->paginate(20);

        $remplis = Reponse::where('utilisateur_id', $u->id)
            ->whereIn('formulaire_id', $page->pluck('id'))
            ->pluck('formulaire_id')->all();

        return response()->json($page->through(function ($f) use ($gestionnaire, $remplis) {
            $item = $this->formater($f, false);
            $item['deja_repondu'] = in_array($f->id, $remplis, true);
            if ($gestionnaire) {
                $item['nb_reponses'] = $f->reponses_count;
            }

            return $item;
        }));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $u = $request->user();
        $f = $this->visibles($u, $this->peutGerer($u))->with('auteur:id,nom,prenom')->findOrFail($id);

        return response()->json($this->formater($f, true));
    }

    public function store(EnregistrerFormulaireRequest $request): JsonResponse
    {
        $u = $request->user();
        $d = $request->validated();

        $f = Formulaire::create([
            'entreprise_id' => $u->entreprise_id,
            'auteur_id' => $u->id,
            'departement_id' => $d['visibilite'] === 'departement' ? $d['departement_id'] : null,
            'titre_formulaire' => $d['titre_formulaire'],
            'champs' => $this->nettoyerChamps($d['champs']),
            'visibilite' => $d['visibilite'],
            'reponse_unique' => $d['reponse_unique'] ?? false,
            'date_limite' => $d['date_limite'] ?? null,
            'statut_formulaire' => $d['statut_formulaire'] ?? 'publie',
        ]);

        return response()->json($this->formater($f->load('auteur:id,nom,prenom'), true), 201);
    }

    public function update(EnregistrerFormulaireRequest $request, int $id): JsonResponse
    {
        $f = $this->gerer($request, $id);
        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }
        if ($f->statut_formulaire === 'cloture') {
            return response()->json(['message' => 'Un formulaire clôturé ne peut plus être modifié.'], 422);
        }
        if (isset($d['champs']) && $f->reponses()->exists()) {
            return response()->json(['message' => 'Les champs ne peuvent plus être modifiés : le formulaire a déjà reçu des réponses.',
                'errors' => ['champs' => ['Verrouillés après la première réponse.']]], 422);
        }

        $visibilite = $d['visibilite'] ?? $f->visibilite;
        $dept = array_key_exists('departement_id', $d) ? $d['departement_id'] : $f->departement_id;
        if ($visibilite === 'entreprise') {
            $dept = null;
        }
        if ($visibilite === 'departement' && ! $dept) {
            return response()->json(['message' => 'Un département est requis.',
                'errors' => ['departement_id' => ['Un département est requis.']]], 422);
        }

        $modifs = array_diff_key($d, ['visibilite' => 1, 'departement_id' => 1, 'champs' => 1])
            + ['visibilite' => $visibilite, 'departement_id' => $dept];
        if (isset($d['champs'])) {
            $modifs['champs'] = $this->nettoyerChamps($d['champs']);
        }
        $f->update($modifs);

        return response()->json($this->formater($f->load('auteur:id,nom,prenom'), true));
    }

    public function publier(Request $request, int $id): JsonResponse
    {
        $f = $this->gerer($request, $id);
        if ($f->statut_formulaire !== 'brouillon') {
            return response()->json(['message' => 'Seul un brouillon peut être publié.'], 422);
        }
        if ($f->date_limite && $f->date_limite->lt(today())) {
            return response()->json(['message' => 'La date limite est dépassée.'], 422);
        }
        $f->update(['statut_formulaire' => 'publie']);

        return response()->json($this->formater($f->load('auteur:id,nom,prenom'), true));
    }

    public function cloturer(Request $request, int $id): JsonResponse
    {
        $f = $this->gerer($request, $id);
        if ($f->statut_formulaire === 'cloture') {
            return response()->json(['message' => 'Ce formulaire est déjà clôturé.'], 422);
        }
        $f->update(['statut_formulaire' => 'cloture']);

        return response()->json($this->formater($f->load('auteur:id,nom,prenom'), true));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->gerer($request, $id)->delete();

        return response()->json(['message' => 'Formulaire supprimé.']);
    }

    public function reponses(Request $request, int $id): JsonResponse
    {
        $f = $this->gerer($request, $id);

        $page = $f->reponses()->with('utilisateur:id,nom,prenom')->orderBy('id')->paginate(50);

        return response()->json([
            'formulaire' => $this->formater($f, true),
            'reponses' => $page->through(fn ($r) => [
                'id' => $r->id,
                'utilisateur' => $r->utilisateur ? $r->utilisateur->only(['id', 'nom', 'prenom']) : null,
                'valeurs' => $r->valeurs,
                'created_at' => $r->created_at,
            ]),
        ]);
    }

    public function repondre(Request $request, int $id): JsonResponse
    {
        $u = $request->user();
        $f = $this->visibles($u, false, false)->findOrFail($id);

        $valeurs = $request->validate(['valeurs' => 'required|array|max:30'])['valeurs'];
        $propre = $this->controlerValeurs($f, $valeurs);

        $reponse = DB::transaction(function () use ($f, $u, $propre) {
            $f = Formulaire::whereKey($f->id)->lockForUpdate()->first();

            if (! $f->estOuvert()) {
                abort(response()->json(['message' => 'Ce formulaire n\'accepte plus de réponses.'], 422));
            }
            if ($f->reponse_unique && $f->reponses()->where('utilisateur_id', $u->id)->exists()) {
                abort(response()->json(['message' => 'Vous avez déjà répondu à ce formulaire.'], 422));
            }

            return Reponse::create([
                'formulaire_id' => $f->id,
                'entreprise_id' => $u->entreprise_id,
                'utilisateur_id' => $u->id,
                'valeurs' => $propre,
            ]);
        });

        return response()->json(['message' => 'Réponse enregistrée.', 'id' => $reponse->id], 201);
    }

    private function peutGerer(Utilisateur $u): bool
    {
        return $u->role->permissions()->where('code_permission', 'formulaires.gerer')->exists();
    }

    private function gerer(Request $request, int $id): Formulaire
    {
        $u = $request->user();
        if (! $this->peutGerer($u)) {
            abort(403, 'Action non autorisée.');
        }

        return Formulaire::where('entreprise_id', $u->entreprise_id)->findOrFail($id);
    }

    private function visibles(Utilisateur $u, bool $gestionnaire, bool $ouvertsSeulement = true): Builder
    {
        $q = Formulaire::where('entreprise_id', $u->entreprise_id);
        if ($gestionnaire) {
            return $q;
        }

        $q->whereIn('statut_formulaire', $ouvertsSeulement ? ['publie'] : ['publie', 'cloture']);
        if ($ouvertsSeulement) {
            $q->where(fn ($w) => $w->whereNull('date_limite')
                ->orWhere('date_limite', '>=', today()->toDateString()));
        }

        return $q->where(function ($w) use ($u) {
            $w->where('visibilite', 'entreprise');
            if ($u->departement_id) {
                $w->orWhere(fn ($w2) => $w2->where('visibilite', 'departement')
                    ->where('departement_id', $u->departement_id));
            }
        });
    }

    private function nettoyerChamps(array $champs): array
    {
        return array_values(array_map(function ($c) {
            $champ = [
                'nom' => $c['nom'],
                'libelle' => $c['libelle'],
                'type' => $c['type'],
                'obligatoire' => (bool) ($c['obligatoire'] ?? false),
            ];
            if (in_array($c['type'], ['choix_unique', 'choix_multiple'], true)) {
                $champ['options'] = array_values($c['options']);
            }

            return $champ;
        }, $champs));
    }

    private function controlerValeurs(Formulaire $f, array $valeurs): array
    {
        $erreurs = [];
        $propre = [];
        $noms = array_column($f->champs, 'nom');

        foreach (array_diff(array_keys($valeurs), $noms) as $inconnu) {
            $erreurs["valeurs.$inconnu"] = ['Champ inconnu.'];
        }

        foreach ($f->champs as $c) {
            $nom = $c['nom'];
            $v = $valeurs[$nom] ?? null;
            $vide = $v === null || $v === '' || $v === [];

            if ($vide) {
                if ($c['obligatoire']) {
                    $erreurs["valeurs.$nom"] = ['Ce champ est obligatoire.'];
                }

                continue;
            }

            $ok = match ($c['type']) {
                'texte' => is_string($v) && mb_strlen($v) <= 255,
                'texte_long' => is_string($v) && mb_strlen($v) <= 5000,
                'nombre' => is_int($v) || is_float($v) || (is_string($v) && is_numeric($v)),
                'date' => is_string($v) && strtotime($v) !== false,
                'choix_unique' => is_string($v) && in_array($v, $c['options'], true),
                'choix_multiple' => is_array($v) && collect($v)->every('is_string') && array_diff($v, $c['options']) === [],
                default => false,
            };

            if (! $ok) {
                $erreurs["valeurs.$nom"] = ['Valeur invalide pour « '.$c['libelle'].' ».'];

                continue;
            }
            $propre[$nom] = $v;
        }

        if ($erreurs) {
            abort(response()->json(['message' => 'Réponse invalide.', 'errors' => $erreurs], 422));
        }

        return $propre;
    }

    private function formater(Formulaire $f, bool $avecChamps): array
    {
        $x = [
            'id' => $f->id,
            'titre_formulaire' => $f->titre_formulaire,
            'visibilite' => $f->visibilite,
            'departement_id' => $f->departement_id,
            'reponse_unique' => $f->reponse_unique,
            'date_limite' => $f->date_limite?->toDateString(),
            'statut_formulaire' => $f->statut_formulaire,
            'auteur' => $f->auteur ? $f->auteur->only(['id', 'nom', 'prenom']) : null,
            'created_at' => $f->created_at,
        ];
        if ($avecChamps) {
            $x['champs'] = $f->champs;
        }

        return $x;
    }
}

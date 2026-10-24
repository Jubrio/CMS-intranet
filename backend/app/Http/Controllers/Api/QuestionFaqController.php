<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EnregistrerQuestionRequest;
use App\Models\QuestionFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuestionFaqController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['q' => 'nullable|string|max:100', 'categorie' => 'nullable|string|max:50']);

        $requete = QuestionFaq::where('entreprise_id', $request->user()->entreprise_id); // RG05
        if ($q = trim((string) $request->query('q'))) {
            $motif = '%'.addcslashes($q, '%_\\').'%';
            $requete->where(fn ($w) => $w->where('question', 'ilike', $motif)->orWhere('reponse', 'ilike', $motif));
        }
        if ($request->filled('categorie')) {
            $requete->where('categorie', $request->query('categorie'));
        }

        $page = $requete->with('auteur:id,nom,prenom')
            ->orderBy('categorie')->orderBy('question')->paginate(20);

        return response()->json($page->through(fn ($q) => $this->formater($q)));
    }

    public function categories(Request $request): JsonResponse
    {
        return response()->json(
            QuestionFaq::where('entreprise_id', $request->user()->entreprise_id)
                ->selectRaw('categorie, count(*) as nb_questions')
                ->groupBy('categorie')->orderBy('categorie')->get()
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->formater($this->trouver($request, $id)));
    }

    public function store(EnregistrerQuestionRequest $request): JsonResponse
    {
        $u = $request->user();
        $question = QuestionFaq::create($request->validated() + [
            'entreprise_id' => $u->entreprise_id,
            'auteur_id' => $u->id,
        ]);

        return response()->json($this->formater($question->load('auteur:id,nom,prenom')), 201);
    }

    public function update(EnregistrerQuestionRequest $request, int $id): JsonResponse
    {
        $question = $this->trouver($request, $id);
        $d = $request->validated();
        if (empty($d)) {
            return response()->json(['message' => 'Aucun champ à modifier.'], 422);
        }
        $question->update($d);

        return response()->json($this->formater($question));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->trouver($request, $id)->delete();

        return response()->json(['message' => 'Question supprimée.']);
    }

    private function trouver(Request $request, int $id): QuestionFaq
    {
        return QuestionFaq::with('auteur:id,nom,prenom')
            ->where('entreprise_id', $request->user()->entreprise_id)->findOrFail($id);
    }

    private function formater(QuestionFaq $q): array
    {
        return [
            'id' => $q->id,
            'question' => $q->question,
            'reponse' => $q->reponse,
            'categorie' => $q->categorie,
            'auteur' => $q->auteur ? $q->auteur->only(['id', 'nom', 'prenom']) : null,
            'updated_at' => $q->updated_at,
        ];
    }
}

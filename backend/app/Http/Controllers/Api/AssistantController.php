<?php

namespace App\Http\Controllers\Api;

use App\Assistant\AgentService;
use App\Assistant\AssistantIndisponible;
use App\Assistant\Formulaires;
use App\Assistant\ToolRegistry;
use App\Assistant\Tools\ToolException;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssistantController extends Controller
{
    public function __construct(private AgentService $agent, private ToolRegistry $outils, private Formulaires $formulaires) {}

    /** Message de l'administrateur : renvoie la réponse et les actions à confirmer. */
    public function envoyer(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'conversation_id' => ['nullable', 'integer'],
        ]);
        $utilisateur = $request->user();

        // L'assistant n'a de sens que si le rôle donne accès à au moins un outil.
        if (! $this->outils->schemasPour($utilisateur)) {
            return response()->json(['message' => "L'assistant n'est pas disponible pour votre rôle."], 403);
        }

        // Le premier appel charge le modèle en mémoire : il peut dépasser les 30 s par défaut de PHP.
        set_time_limit(300);

        try {
            $resultat = $this->agent->envoyer($utilisateur, $donnees['conversation_id'] ?? null, $donnees['message']);
        } catch (AssistantIndisponible $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        return response()->json($resultat);
    }

    /** Actions disponibles sous forme de formulaire pour le rôle de l'utilisateur. */
    public function formulaires(Request $request): JsonResponse
    {
        $liste = $this->formulaires->catalogue($request->user());
        if ($liste === []) {
            return response()->json(['message' => "L'assistant n'est pas disponible pour votre rôle."], 403);
        }

        return response()->json(['formulaires' => $liste]);
    }

    /** Un formulaire vide, avec ses listes (départements, rôles, comptes, contenus existants). */
    public function formulaire(Request $request, string $outil): JsonResponse
    {
        try {
            $formulaire = $this->formulaires->construire($request->user(), $outil);
        } catch (ToolException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json(Formulaires::enJson($formulaire));
    }

    /** Formulaire rempli : les valeurs sont contrôlées, puis l'action est préparée pour confirmation. */
    public function soumettre(Request $request, string $outil): JsonResponse
    {
        $donnees = $request->validate([
            'valeurs' => ['required', 'array'],
            'conversation_id' => ['nullable', 'integer'],
        ]);

        try {
            $resultat = $this->agent->soumettreFormulaire($request->user(), $donnees['conversation_id'] ?? null, $outil, $donnees['valeurs']);
        } catch (ToolException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($resultat);
    }

    /** Exécute une action en attente. Le mot de passe temporaire n'est renvoyé qu'ici, une seule fois. */
    public function confirmer(Request $request, int $id): JsonResponse
    {
        try {
            $resultat = $this->agent->confirmer($request->user(), $id);
        } catch (ToolException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return response()
            ->json($resultat, $resultat['ok'] ? 200 : 422)
            ->header('Cache-Control', 'no-store');
    }

    public function annuler(Request $request, int $id): JsonResponse
    {
        try {
            $this->agent->annuler($request->user(), $id);
        } catch (ToolException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return response()->json(['message' => 'Action annulée.']);
    }
}

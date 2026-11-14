<?php

namespace App\Assistant;

use App\Assistant\Tools\ToolException;
use App\Models\AssistantAction;
use App\Models\AssistantConversation;
use App\Models\AssistantMessage;
use App\Models\Utilisateur;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Boucle de l'assistant : message de l'administrateur -> Ollama -> appel d'outil -> action en attente
 * de confirmation -> exécution par Laravel uniquement après confirmation explicite.
 *
 * Le modèle ne touche jamais à la base : il propose des appels d'outils, Laravel les contrôle et les exécute.
 */
class AgentService
{
    private const INVITE = "Tu es l'assistant de l'administrateur d'un intranet d'entreprise. "
        .'Réponds toujours en français, de façon brève. '
        ."Tu n'agis sur l'intranet qu'en appelant les outils fournis : n'affirme jamais qu'une action est faite sans appel d'outil. "
        .'Ne demande jamais de mot de passe : il est généré automatiquement. '
        ."Si une information obligatoire manque, demande-la à l'administrateur au lieu de l'inventer. "
        .'Si la demande dépasse ce que les outils permettent, dis-le simplement.';

    public function __construct(private ToolRegistry $outils) {}

    /**
     * @return array{conversation_id: int, reponse: string, actions: list<array{id: int, outil: string, resume: string}>}
     */
    public function envoyer(Utilisateur $utilisateur, ?int $conversationId, string $texte): array
    {
        $conversation = $conversationId
            ? AssistantConversation::where('utilisateur_id', $utilisateur->id)->findOrFail($conversationId)
            : AssistantConversation::create([
                'utilisateur_id' => $utilisateur->id,
                'entreprise_id' => $utilisateur->entreprise_id,
                'titre' => mb_substr($texte, 0, 80),
            ]);

        $this->noter($conversation->id, 'user', $texte);

        $messages = $this->construireMessages($conversation);
        $schemas = $this->outils->schemasPour($utilisateur);
        $actions = [];

        for ($tour = 0; $tour < config('assistant.max_tours'); $tour++) {
            $reponse = $this->appelerModele($messages, $schemas);
            $appels = $reponse['tool_calls'] ?? [];

            if (empty($appels)) {
                $contenu = trim((string) ($reponse['content'] ?? ''));
                if ($contenu === '') {
                    $contenu = "Je n'ai pas compris la demande. Pouvez-vous la reformuler ?";
                }
                $this->noter($conversation->id, 'assistant', $contenu);

                return $this->resultat($conversation, $contenu, $actions);
            }

            $messages[] = ['role' => 'assistant', 'content' => (string) ($reponse['content'] ?? ''), 'tool_calls' => $appels];

            foreach ($appels as $appel) {
                $nom = (string) ($appel['function']['name'] ?? '');
                $params = $appel['function']['arguments'] ?? [];
                if (is_string($params)) {
                    $params = json_decode($params, true) ?: [];
                }

                $retour = $this->traiterAppel($utilisateur, $conversation, $nom, (array) $params, $actions);
                $messages[] = [
                    'role' => 'tool',
                    'tool_name' => $nom,
                    'content' => json_encode($retour, JSON_UNESCAPED_UNICODE),
                ];
            }

            // Une action attend la confirmation : on s'arrête, c'est l'administrateur qui décide.
            if ($actions) {
                $texte = "À confirmer :\n- ".implode("\n- ", array_column($actions, 'resume'));
                $this->noter($conversation->id, 'assistant', $texte);

                return $this->resultat($conversation, $texte, $actions);
            }
        }

        $contenu = "Je n'arrive pas à terminer cette demande. Précisez-la ou découpez-la en étapes.";
        $this->noter($conversation->id, 'assistant', $contenu);

        return $this->resultat($conversation, $contenu, $actions);
    }

    /**
     * Exécute une action en attente, avec les droits de l'administrateur qui confirme.
     *
     * @return array{ok: bool, message: string, secret: array|null}
     *                                                              'secret' (mot de passe temporaire) n'est renvoyé qu'ici, une seule fois : jamais stocké, jamais envoyé au modèle.
     */
    public function confirmer(Utilisateur $utilisateur, int $actionId): array
    {
        return DB::transaction(function () use ($utilisateur, $actionId) {
            $action = AssistantAction::where('utilisateur_id', $utilisateur->id)->lockForUpdate()->findOrFail($actionId);

            if ($action->statut !== AssistantAction::EN_ATTENTE) {
                throw new ToolException('Cette action a déjà été traitée.');
            }

            $action->update(['statut' => AssistantAction::CONFIRMEE, 'confirmee_le' => now()]);

            try {
                $outil = $this->outils->trouver($action->outil)
                    ?? throw new ToolException('Outil introuvable.');
                $resultat = $outil->execute($utilisateur, $action->parametres);
            } catch (ToolException $e) {
                $action->update(['statut' => AssistantAction::ECHEC, 'erreur' => $e->getMessage()]);
                $this->noter($action->conversation_id, 'assistant', "L'action a échoué : ".$e->getMessage());

                return ['ok' => false, 'message' => $e->getMessage(), 'secret' => null];
            }

            $action->update([
                'statut' => AssistantAction::EXECUTEE,
                'executee_le' => now(),
                'resultat' => $resultat['donnees'],
            ]);
            $this->noter($action->conversation_id, 'assistant', $resultat['message']);

            return ['ok' => true, 'message' => $resultat['message'], 'secret' => $resultat['secret'] ?? null];
        });
    }

    public function annuler(Utilisateur $utilisateur, int $actionId): void
    {
        DB::transaction(function () use ($utilisateur, $actionId) {
            $action = AssistantAction::where('utilisateur_id', $utilisateur->id)->lockForUpdate()->findOrFail($actionId);

            if ($action->statut !== AssistantAction::EN_ATTENTE) {
                throw new ToolException('Cette action a déjà été traitée.');
            }

            $action->update(['statut' => AssistantAction::ANNULEE]);
            $this->noter($action->conversation_id, 'assistant', "Action annulée par l'administrateur.");
        });
    }

    /**
     * Traite un appel d'outil du modèle et renvoie ce que le modèle verra comme résultat.
     * Les actions à confirmer sont ajoutées à $actions ; rien n'est exécuté à ce stade.
     */
    private function traiterAppel(Utilisateur $utilisateur, AssistantConversation $conversation, string $nom, array $params, array &$actions): array
    {
        $outil = $this->outils->trouver($nom);
        if (! $outil) {
            return ['erreur' => "L'outil « {$nom} » n'existe pas."];
        }
        if (! $outil->authorize($utilisateur)) {
            return ['erreur' => 'Action non autorisée pour le rôle de cet utilisateur.'];
        }

        try {
            $normalises = $outil->validate($utilisateur, $params);

            if ($outil->requiresConfirmation()) {
                $action = AssistantAction::create([
                    'conversation_id' => $conversation->id,
                    'utilisateur_id' => $utilisateur->id,
                    'outil' => $nom,
                    'parametres' => $normalises,
                    'statut' => AssistantAction::EN_ATTENTE,
                ]);
                $resume = $outil->summary($normalises);
                $actions[] = ['id' => $action->id, 'outil' => $nom, 'resume' => $resume];

                return ['statut' => 'en_attente_de_confirmation', 'resume' => $resume];
            }

            // Outil sans confirmation (lecture seule, plus tard) : exécuté tout de suite et journalisé.
            $resultat = $outil->execute($utilisateur, $normalises);
            AssistantAction::create([
                'conversation_id' => $conversation->id,
                'utilisateur_id' => $utilisateur->id,
                'outil' => $nom,
                'parametres' => $normalises,
                'statut' => AssistantAction::EXECUTEE,
                'resultat' => $resultat['donnees'],
                'executee_le' => now(),
            ]);

            return ['succes' => true, 'message' => $resultat['message'], 'donnees' => $resultat['donnees']];
        } catch (ToolException $e) {
            return ['erreur' => $e->getMessage()];
        }
    }

    /** Invite système + derniers messages texte de la conversation. */
    private function construireMessages(AssistantConversation $conversation): array
    {
        $historique = AssistantMessage::where('conversation_id', $conversation->id)
            ->whereIn('role', ['user', 'assistant'])
            ->orderByDesc('id')
            ->limit(config('assistant.historique'))
            ->get()
            ->reverse()
            ->map(fn (AssistantMessage $m) => ['role' => $m->role, 'content' => (string) $m->contenu])
            ->values()
            ->all();

        return array_merge([['role' => 'system', 'content' => self::INVITE]], $historique);
    }

    private function appelerModele(array $messages, array $schemas): array
    {
        $corps = [
            'model' => config('assistant.modele'),
            'stream' => false,
            'messages' => $messages,
            'options' => ['temperature' => 0.1],
        ];
        if ($schemas) {
            $corps['tools'] = $schemas;
        }

        try {
            $reponse = Http::timeout(config('assistant.delai'))
                ->acceptJson()
                ->post(rtrim(config('assistant.ollama_url'), '/').'/api/chat', $corps)
                ->throw();
        } catch (ConnectionException|RequestException $e) {
            Log::warning('Assistant : Ollama injoignable ou en erreur.', ['erreur' => $e->getMessage()]);
            throw new AssistantIndisponible;
        }

        return $reponse->json('message') ?? [];
    }

    private function noter(int $conversationId, string $role, string $contenu): void
    {
        AssistantMessage::create(['conversation_id' => $conversationId, 'role' => $role, 'contenu' => $contenu]);
    }

    private function resultat(AssistantConversation $conversation, string $reponse, array $actions): array
    {
        return ['conversation_id' => $conversation->id, 'reponse' => $reponse, 'actions' => $actions];
    }
}

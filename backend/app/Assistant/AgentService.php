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
use Illuminate\Support\Str;

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
        ."Pour publier un contenu, rédige le texte uniquement à partir des informations de l'administrateur : n'invente jamais de faits (dates, lieux, chiffres). "
        ."Désigne une personne par son adresse e-mail si tu la connais, sinon par son nom complet tel que l'administrateur l'a écrit : n'invente jamais une adresse e-mail. "
        ."Si une information obligatoire manque, demande-la à l'administrateur au lieu de l'inventer. "
        ."Pour modifier, publier, archiver ou clôturer un élément existant (contenu, page, événement, question FAQ, document, formulaire), désigne-le par son titre actuel exactement comme l'administrateur l'a écrit ; n'invente jamais d'identifiant. Si l'outil signale plusieurs correspondances ou aucune, appelle l'outil lister correspondant ou demande à l'administrateur de préciser. "
        .'Quand tu présentes une liste, écris pour chaque personne ou élément les libellés explicites, par exemple « Jean Rakoto — rôle : Administrateur, département : aucun, statut : actif ». '
        .'Réponds en texte brut, sans mise en forme Markdown : jamais de **, de # ni de tableaux. Pour une liste, une ligne par élément commençant par un tiret, par exemple « - Pas de travail demain — Jean Rakoto, 15/11/2026 ». '
        ."Pour toute question sur des données existantes (qui est dans un département, liste de comptes, de contenus, d'événements, de documents...), appelle toujours l'outil lister correspondant, par exemple lister_utilisateurs avec le champ departement : n'invente jamais de personnes, de titres ni de chiffres. "
        ."N'entoure jamais ta réponse de blocs de code. "
        .'Si la demande dépasse ce que les outils permettent, dis-le simplement.';

    public function __construct(private ToolRegistry $outils, private Formulaires $formulaires, private AideIntranet $aide) {}

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

        // Ce que la personne a écrit récemment : les champs d'identité du formulaire doivent en venir, jamais du modèle.
        $dit = AssistantMessage::where('conversation_id', $conversation->id)->where('role', 'user')
            ->orderByDesc('id')->limit(6)->pluck('contenu')->implode(' ');

        // Question d'explication (« comment fonctionne… », « c'est quoi… ») : réponse à partir de l'aide, sans outil.
        $contexteAide = $this->aide->contexte($utilisateur, $texte);
        $modeAide = $contexteAide !== null;

        $messages = $this->construireMessages($conversation, $contexteAide);
        $schemas = $modeAide ? [] : $this->outils->schemasPour($utilisateur);
        $actions = [];
        $formulaires = [];
        $question = $texte;
        $outilAppele = false;
        $relance = false;

        for ($tour = 0; $tour < config('assistant.max_tours'); $tour++) {
            $reponse = $this->appelerModele($messages, $schemas);
            $appels = $reponse['tool_calls'] ?? [];

            if (empty($appels)) {
                $appels = AppelsEnTexte::extraire(
                    (string) ($reponse['content'] ?? ''),
                    array_map(fn ($s) => $s['function']['name'], $schemas)
                );
                if ($appels) {
                    $reponse['content'] = '';
                }
            }

            // Question sur des données sans aucun appel d'outil : le modèle les invente. On le force une fois à
            // consulter l'intranet ; s'il persiste, sa réponse n'est jamais affichée.
            if (empty($appels) && ! $outilAppele && ! $modeAide && $this->questionSurDesDonnees($question)) {
                if (! $relance) {
                    $relance = true;
                    $messages[] = ['role' => 'system', 'content' => "Tu n'as appelé aucun outil. Pour répondre, appelle d'abord l'outil lister adapté (lister_utilisateurs avec le filtre departement, lister_departements, lister_contenus, lister_evenements, lister_faq, lister_pages, lister_documents ou lister_formulaires). N'invente aucune donnée."];

                    continue;
                }
                $contenu = "Je n'ai pas pu consulter ces informations de façon fiable. Reformulez, par exemple « Liste les utilisateurs du département Support », ou utilisez les suggestions.";
                $this->noter($conversation->id, 'assistant', $contenu);

                return $this->resultat($conversation, $contenu, $actions);
            }

            if (empty($appels)) {
                $contenu = $this->nettoyer((string) ($reponse['content'] ?? ''));
                if ($contenu === '') {
                    $contenu = "Je n'ai pas compris la demande. Pouvez-vous la reformuler ?";
                }
                $this->noter($conversation->id, 'assistant', $contenu);

                return $this->resultat($conversation, $contenu, $actions);
            }

            // Ollama exige des arguments sous forme d'objet JSON : un « {} » vide ne doit pas devenir « [] ».
            $appels = array_map(function (array $appel) {
                $args = $appel['function']['arguments'] ?? [];
                if (is_string($args)) {
                    $args = json_decode($args, true) ?: [];
                }
                $appel['function']['arguments'] = $args === [] ? new \stdClass : $args;

                return $appel;
            }, $appels);

            $messages[] = ['role' => 'assistant', 'content' => (string) ($reponse['content'] ?? ''), 'tool_calls' => $appels];

            foreach ($appels as $appel) {
                $outilAppele = true;
                $nom = (string) ($appel['function']['name'] ?? '');
                $params = $appel['function']['arguments'] ?? [];
                if (is_string($params)) {
                    $params = json_decode($params, true) ?: [];
                }

                $retour = $this->traiterAppel($utilisateur, $conversation, $nom, (array) $params, $actions, $formulaires, $dit);
                $messages[] = [
                    'role' => 'tool',
                    'tool_name' => $nom,
                    'content' => json_encode($retour, JSON_UNESCAPED_UNICODE),
                ];
            }

            // Mode formulaire : la personne vérifie et complète les champs, puis confirme.
            if ($formulaires) {
                $texte = $formulaires[0]['valeurs'] === []
                    ? 'Complétez ce formulaire : je prépare ensuite l\'action, vous confirmez.'
                    : 'Vérifiez et complétez ce formulaire : je prépare ensuite l\'action, vous confirmez.';
                $this->noter($conversation->id, 'assistant', $texte);

                return $this->resultat($conversation, $texte, $actions) + ['formulaires' => array_map([Formulaires::class, 'enJson'], $formulaires)];
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
     * Valide un formulaire rempli par l'administrateur et prépare l'action à confirmer (rien n'est exécuté ici).
     *
     * @return array{conversation_id: int, reponse: string, actions: list<array{id: int, outil: string, resume: string}>}
     *
     * @throws ToolException si les valeurs sont refusées (droits, module, champ invalide...)
     */
    public function soumettreFormulaire(Utilisateur $utilisateur, ?int $conversationId, string $nom, array $valeurs): array
    {
        $outil = $this->outils->trouver($nom);
        if (! $outil || ! $outil->requiresConfirmation() || ! $outil->authorize($utilisateur)) {
            throw new ToolException("Ce formulaire n'est pas disponible pour votre rôle.");
        }

        $normalises = $outil->validate($utilisateur, $this->formulaires->parametres($utilisateur, $nom, $valeurs));

        $conversation = $conversationId
            ? AssistantConversation::where('utilisateur_id', $utilisateur->id)->findOrFail($conversationId)
            : AssistantConversation::create([
                'utilisateur_id' => $utilisateur->id,
                'entreprise_id' => $utilisateur->entreprise_id,
                'titre' => mb_substr($nom, 0, 80),
            ]);

        $action = AssistantAction::create([
            'conversation_id' => $conversation->id,
            'utilisateur_id' => $utilisateur->id,
            'outil' => $nom,
            'parametres' => $normalises,
            'statut' => AssistantAction::EN_ATTENTE,
        ]);
        $resume = $outil->summary($normalises);
        $texte = "À confirmer :\n- ".$resume;
        $this->noter($conversation->id, 'assistant', $texte);

        return $this->resultat($conversation, $texte, [['id' => $action->id, 'outil' => $nom, 'resume' => $resume]]);
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
    private function traiterAppel(Utilisateur $utilisateur, AssistantConversation $conversation, string $nom, array $params, array &$actions, array &$formulaires, string $dit): array
    {
        $outil = $this->outils->trouver($nom);
        if (! $outil) {
            return ['erreur' => "L'outil « {$nom} » n'existe pas."];
        }
        if (! $outil->authorize($utilisateur)) {
            return ['erreur' => 'Action non autorisée pour le rôle de cet utilisateur.'];
        }

        try {
            if ($outil->requiresConfirmation() && $this->modeFormulaire()) {
                $formulaires[] = $this->formulaires->construire($utilisateur, $nom, $params, $dit);

                return ['statut' => 'formulaire_affiche', 'note' => "Un formulaire est affiché à l'utilisateur pour vérifier et compléter les informations."];
            }

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

    /** Active avec ASSISTANT_FORMULAIRES=true : le modèle ne fait que choisir l'action, la personne remplit le formulaire. */
    private function modeFormulaire(): bool
    {
        return (bool) config('assistant.formulaires', env('ASSISTANT_FORMULAIRES', false));
    }

    /** Invite système + derniers messages texte de la conversation. */
    private function construireMessages(AssistantConversation $conversation, ?string $aide = null): array
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

        return array_merge([['role' => 'system', 'content' => self::INVITE.' Date du jour : '.now()->format('d/m/Y').'.'.($aide ? "\n\n".$aide : '')]], $historique);
    }

    private function appelerModele(array $messages, array $schemas): array
    {
        $corps = [
            'model' => config('assistant.modele'),
            'stream' => false,
            'messages' => $messages,
            'options' => ['temperature' => 0.1, 'num_ctx' => 8192],
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

    /** Question qui porte sur des données de l'intranet (comptes, contenus...) : la réponse doit venir d'un outil. */
    private function questionSurDesDonnees(string $texte): bool
    {
        $t = Str::lower(Str::ascii($texte));
        $interrogation = preg_match('/\b(qui|quels?|quelles?|combien|list(e|er|ez)|montr(e|er|ez)|affich(e|er|ez)|donn(e|er|ez)|existe|y a)\b/u', $t) === 1;
        $donnees = preg_match('/(utilisateur|compte|personne|employe|manager|membre|collegue|departement|actualite|annonce|article|note de service|evenement|faq|page|document|formulaire)/u', $t) === 1;

        return $interrogation && $donnees;
    }

    /** Le panneau affiche du texte brut : on retire le Markdown que le modèle ajoute par habitude. */
    private function nettoyer(string $texte): string
    {
        $texte = preg_replace('/```[a-z]*[ \t]*\n?/i', '', $texte);
        $texte = str_replace(['**', '__'], '', $texte);
        $texte = preg_replace('/^\s{0,3}#{1,6}\s*/m', '', $texte);
        $texte = preg_replace('/^\s*\*\s+/m', '- ', $texte);
        $texte = preg_replace('/[ \t]+$/m', '', $texte);
        $texte = preg_replace("/\n{3,}/", "\n\n", $texte);

        return trim($texte);
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

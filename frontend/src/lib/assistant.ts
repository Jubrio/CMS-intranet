import { api } from "@/lib/api";

/** Action préparée par l'assistant, en attente de la confirmation de l'administrateur. */
export type ActionPropose = { id: number; outil: string; resume: string };

export type ReponseAssistant = {
  conversation_id: number;
  reponse: string;
  actions: ActionPropose[];
};

export type ResultatConfirmation = {
  ok: boolean;
  message: string;
  /** Renvoyé une seule fois, à la confirmation : jamais stocké côté serveur. */
  secret: { mot_de_passe_temporaire?: string } | null;
};

export function envoyerMessage(token: string, message: string, conversationId: number | null) {
  return api<ReponseAssistant>("/assistant/messages", {
    method: "POST",
    token,
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
}

export function confirmerAction(token: string, actionId: number) {
  return api<ResultatConfirmation>(`/assistant/actions/${actionId}/confirmer`, { method: "POST", token });
}

export function annulerAction(token: string, actionId: number) {
  return api<{ message: string }>(`/assistant/actions/${actionId}/annuler`, { method: "POST", token });
}

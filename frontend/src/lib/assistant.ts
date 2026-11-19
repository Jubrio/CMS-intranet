import { api } from "@/lib/api";

/** Action préparée par l'assistant, en attente de la confirmation de l'administrateur. */
export type ActionPropose = { id: number; outil: string; resume: string };

export type OptionChamp = { valeur: string | number; libelle: string; type?: string };

/** Champ d'un formulaire généré par le serveur à partir d'un outil de l'assistant. */
export type ChampFormulaire = {
  nom: string;
  libelle: string;
  type: "texte" | "zone" | "choix" | "oui_non" | "date" | "date_heure";
  requis: boolean;
  options?: OptionChamp[];
  /** Libellé de l'option vide (ex. « Toute l'entreprise », « Ne pas changer »). */
  vide?: string;
  /** Les options se filtrent selon la valeur d'un autre champ (ex. le type de contenu). */
  si?: { champ: string };
};

export type ValeursFormulaire = Record<string, string | number | boolean>;

export type FormulaireAssistant = {
  outil: string;
  titre: string;
  aide: string | null;
  champs: ChampFormulaire[];
  valeurs: ValeursFormulaire;
};

export type ReponseAssistant = {
  conversation_id: number;
  reponse: string;
  actions: ActionPropose[];
  formulaires?: FormulaireAssistant[];
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

/** Formulaire vide d'une action (listes de départements, rôles, comptes, contenus existants). */
export function formulaireVide(token: string, outil: string) {
  return api<FormulaireAssistant>(`/assistant/formulaires/${outil}`, { token });
}

/** Formulaire rempli : le serveur contrôle les valeurs et prépare l'action à confirmer. */
export function soumettreFormulaire(
  token: string,
  outil: string,
  valeurs: ValeursFormulaire,
  conversationId: number | null,
) {
  return api<ReponseAssistant>(`/assistant/formulaires/${outil}`, {
    method: "POST",
    token,
    body: JSON.stringify({ valeurs, conversation_id: conversationId }),
  });
}

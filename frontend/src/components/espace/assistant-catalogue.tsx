"use client";

import { useState } from "react";
import {
  Archive,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileText,
  FolderOpen,
  KeyRound,
  Megaphone,
  MessageSquarePlus,
  Network,
  Pencil,
  Sparkles,
  UserCog,
  UserPlus,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Libellé et icône de la carte de confirmation, par outil du serveur. */
export const OUTILS: Record<string, { libelle: string; Icone: LucideIcon }> = {
  creer_utilisateur: { libelle: "Créer un compte", Icone: UserPlus },
  modifier_utilisateur: { libelle: "Modifier un compte", Icone: UserCog },
  changer_statut_utilisateur: { libelle: "Activer / désactiver un compte", Icone: UserX },
  reinitialiser_mot_de_passe: { libelle: "Réinitialiser un mot de passe", Icone: KeyRound },
  creer_departement: { libelle: "Créer un département", Icone: Network },
  modifier_departement: { libelle: "Modifier un département", Icone: Network },
  publier_contenu: { libelle: "Publier un contenu", Icone: Megaphone },
  modifier_contenu: { libelle: "Modifier un contenu", Icone: Pencil },
  changer_statut_contenu: { libelle: "Publier / archiver un contenu", Icone: Archive },
  creer_evenement: { libelle: "Créer un événement", Icone: CalendarPlus },
  modifier_evenement: { libelle: "Modifier un événement", Icone: CalendarClock },
  creer_question_faq: { libelle: "Ajouter une question à la FAQ", Icone: MessageSquarePlus },
  modifier_question_faq: { libelle: "Modifier une question de la FAQ", Icone: Pencil },
  creer_page: { libelle: "Créer une page", Icone: FileText },
  modifier_page: { libelle: "Modifier une page", Icone: Pencil },
  changer_statut_page: { libelle: "Publier / archiver une page", Icone: Archive },
  modifier_document: { libelle: "Modifier un document", Icone: FolderOpen },
  changer_statut_formulaire: { libelle: "Publier / clôturer un formulaire", Icone: ClipboardList },
};

/** Ce que la personne choisit : un formulaire à ouvrir (outil), ou une phrase à compléter pour l'assistant (modele). */
export type SuggestionChoisie = { outil?: string; valeurs?: Record<string, string | boolean>; modele?: string };

type Suggestion = SuggestionChoisie & { libelle: string; Icone: LucideIcon; permissions: string[] };
type Groupe = { titre: string; suggestions: Suggestion[] };

const PUBLIER = ["actualites.publier", "annonces.publier", "articles.publier", "notes_service.publier"];
const CONSULTER = ["actualites.consulter", "annonces.consulter", "articles.consulter", "notes_service.consulter", ...PUBLIER];

/** Les droits sont indicatifs (ils masquent ce qui est hors rôle) : le serveur contrôle toujours. */
const GROUPES: Groupe[] = [
  {
    titre: "Utilisateurs",
    suggestions: [
      { libelle: "Créer un utilisateur", Icone: UserPlus, outil: "creer_utilisateur", permissions: ["utilisateurs.gerer"] },
      { libelle: "Lister les utilisateurs", Icone: Users, modele: "Liste tous les utilisateurs", permissions: ["utilisateurs.gerer", "annuaire.consulter"] },
      { libelle: "Modifier un compte", Icone: UserCog, outil: "modifier_utilisateur", permissions: ["utilisateurs.gerer"] },
      { libelle: "Désactiver un compte", Icone: UserX, outil: "changer_statut_utilisateur", valeurs: { actif: "false" }, permissions: ["utilisateurs.gerer"] },
      { libelle: "Réinitialiser un mot de passe", Icone: KeyRound, outil: "reinitialiser_mot_de_passe", permissions: ["utilisateurs.gerer"] },
    ],
  },
  {
    titre: "Départements",
    suggestions: [
      { libelle: "Lister les départements", Icone: Network, modele: "Liste les départements", permissions: ["utilisateurs.departements", "utilisateurs.gerer"] },
      { libelle: "Créer un département", Icone: Network, outil: "creer_departement", permissions: ["utilisateurs.departements"] },
      { libelle: "Modifier un département", Icone: Network, outil: "modifier_departement", permissions: ["utilisateurs.departements"] },
    ],
  },
  {
    titre: "Contenus",
    suggestions: [
      { libelle: "Publier une actualité", Icone: Megaphone, outil: "publier_contenu", valeurs: { type: "actualite" }, permissions: PUBLIER },
      { libelle: "Lister les actualités", Icone: FileText, modele: "Montre-moi les actualités publiées", permissions: CONSULTER },
      { libelle: "Archiver un contenu", Icone: Archive, outil: "changer_statut_contenu", valeurs: { type: "actualite", action: "archiver" }, permissions: PUBLIER },
      { libelle: "Modifier un contenu", Icone: Pencil, outil: "modifier_contenu", valeurs: { type: "actualite" }, permissions: PUBLIER },
    ],
  },
  {
    titre: "Événements et FAQ",
    suggestions: [
      { libelle: "Créer un événement", Icone: CalendarPlus, outil: "creer_evenement", permissions: ["evenements.gerer"] },
      { libelle: "Lister les événements", Icone: CalendarDays, modele: "Liste les événements à venir", permissions: ["evenements.consulter", "evenements.gerer"] },
      { libelle: "Modifier un événement", Icone: CalendarClock, outil: "modifier_evenement", permissions: ["evenements.gerer"] },
      { libelle: "Ajouter à la FAQ", Icone: MessageSquarePlus, outil: "creer_question_faq", permissions: ["faq.gerer"] },
      { libelle: "Modifier la FAQ", Icone: Pencil, outil: "modifier_question_faq", permissions: ["faq.gerer"] },
    ],
  },
  {
    titre: "Pages, documents, formulaires",
    suggestions: [
      { libelle: "Créer une page", Icone: FileText, outil: "creer_page", permissions: ["pages.gerer"] },
      { libelle: "Archiver une page", Icone: Archive, outil: "changer_statut_page", valeurs: { action: "archiver" }, permissions: ["pages.gerer"] },
      { libelle: "Lister les documents", Icone: FolderOpen, modele: "Liste les documents", permissions: ["documents.consulter", "documents.gerer"] },
      { libelle: "Modifier un document", Icone: FolderOpen, outil: "modifier_document", permissions: ["documents.gerer"] },
      { libelle: "Lister les formulaires", Icone: ClipboardList, modele: "Liste les formulaires", permissions: ["formulaires.gerer"] },
      { libelle: "Publier un formulaire", Icone: ClipboardList, outil: "changer_statut_formulaire", valeurs: { action: "publier" }, permissions: ["formulaires.gerer"] },
    ],
  },
];

const NB_INITIAL = 4;

/** Suggestions cliquables de l'écran d'accueil, limitées à ce que le rôle de l'utilisateur permet. */
export function SuggestionsAssistant({
  permissions,
  onChoisir,
}: {
  permissions: string[];
  onChoisir: (choix: SuggestionChoisie) => void;
}) {
  const [toutVoir, setToutVoir] = useState(false);

  const groupes = GROUPES.map((g) => ({
    ...g,
    suggestions: g.suggestions.filter((s) => s.permissions.some((p) => permissions.includes(p))),
  })).filter((g) => g.suggestions.length > 0);

  const total = groupes.reduce((n, g) => n + g.suggestions.length, 0);
  if (total === 0) return null;

  let restant = toutVoir ? Infinity : NB_INITIAL;
  const visibles = groupes
    .map((g) => {
      const suggestions = g.suggestions.slice(0, Math.max(restant, 0));
      restant -= suggestions.length;
      return { ...g, suggestions };
    })
    .filter((g) => g.suggestions.length > 0);

  return (
    <div className="space-y-3">
      {visibles.map((g) => (
        <div key={g.titre} className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-site-muted/80">{g.titre}</p>
          <div className="flex flex-wrap gap-2">
            {g.suggestions.map(({ libelle, Icone, outil, valeurs: preset, modele }) => (
              <button
                key={libelle}
                type="button"
                onClick={() => onChoisir({ outil, valeurs: preset, modele })}
                className="inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1.5 text-xs font-medium text-site-ink transition-colors hover:border-brand-violet/60"
              >
                <Icone size={14} aria-hidden />
                {libelle}
              </button>
            ))}
          </div>
        </div>
      ))}
      {total > NB_INITIAL && (
        <button
          type="button"
          onClick={() => setToutVoir((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-violet hover:underline"
        >
          <Sparkles size={13} aria-hidden />
          {toutVoir ? "Réduire" : `Voir tout ce que je peux faire (${total})`}
        </button>
      )}
    </div>
  );
}

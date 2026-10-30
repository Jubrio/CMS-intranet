import { FileText, Megaphone, Newspaper, ScrollText, type LucideIcon } from "lucide-react";

export type ConfigContenu = {
  type: "actualite" | "annonce" | "article" | "note_service";
  permission: string;
  titre: string;
  description: string;
  nom: string;
  feminin: boolean;
  elision: boolean;
  pluriel: string;
  expiration: boolean;
  numero: boolean;
  suiviLectures: boolean;
  icone: LucideIcon;
};

export const ACTUALITES: ConfigContenu = {
  type: "actualite",
  permission: "actualites.publier",
  titre: "Actualités",
  description: "Rédigez, publiez et archivez les actualités de l’entreprise.",
  nom: "actualité",
  feminin: true,
  elision: true,
  pluriel: "actualités",
  expiration: false,
  numero: false,
  suiviLectures: false,
  icone: Newspaper,
};

export const ANNONCES: ConfigContenu = {
  type: "annonce",
  permission: "annonces.publier",
  titre: "Annonces",
  description: "Diffusez des annonces internes, avec une date d’expiration si besoin.",
  nom: "annonce",
  feminin: true,
  elision: true,
  pluriel: "annonces",
  expiration: true,
  numero: false,
  suiviLectures: false,
  icone: Megaphone,
};

export const ARTICLES: ConfigContenu = {
  type: "article",
  permission: "articles.publier",
  titre: "Articles",
  description: "Rédigez, publiez et archivez les articles de l’entreprise.",
  nom: "article",
  feminin: false,
  elision: true,
  pluriel: "articles",
  expiration: false,
  numero: false,
  suiviLectures: false,
  icone: FileText,
};

export const NOTES_SERVICE: ConfigContenu = {
  type: "note_service",
  permission: "notes_service.publier",
  titre: "Notes de service",
  description: "Diffusez les notes de service officielles et suivez leur lecture.",
  nom: "note de service",
  feminin: true,
  elision: false,
  pluriel: "notes de service",
  expiration: false,
  numero: true,
  suiviLectures: true,
  icone: ScrollText,
};

export const textes = (c: ConfigContenu) => {
  const accord = (m: string) => (c.feminin ? `${m}e` : m);
  const Nom = c.nom.charAt(0).toUpperCase() + c.nom.slice(1);
  const defini = c.elision ? `l’${c.nom}` : `${c.feminin ? "la" : "le"} ${c.nom}`;
  const Defini = defini.charAt(0).toUpperCase() + defini.slice(1);
  return {
    Nom,
    defini,
    Defini,
    nouveau: `${c.feminin ? "Nouvelle" : c.elision ? "Nouvel" : "Nouveau"} ${c.nom}`,
    modifierTitre: `Modifier ${defini}`,
    modifiee: `${Nom} ${accord("modifié")}.`,
    brouillon: `${Nom} ${accord("enregistré")} en brouillon.`,
    publiee: `${Nom} ${accord("publié")}.`,
    supprimerTitre: `Supprimer ${c.feminin ? "cette" : c.elision ? "cet" : "ce"} ${c.nom} ?`,
    accord,
  };
};

import {
  Blocks,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  Contact,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutTemplate,
  ListTree,
  Megaphone,
  Newspaper,
  Palette,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Building2,
  type LucideIcon,
} from "lucide-react";

// ---- Formes des réponses de l'API -------------------------------------------

export type Profil = {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  entreprise: string | null;
  permissions: string[];
  modules_actifs: string[];
};

export type Personnalisation = {
  nom_entreprise: string;
  slug: string;
  email_contact: string | null;
  logo_url: string | null;
  couleur_principale: string | null;
  couleur_secondaire: string | null;
};

export const initiales = (p: { prenom: string; nom: string }) =>
  `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase();

// ---- Menu latéral -------------------------------------------------------------
// Une entrée apparaît si le rôle a la permission ET si le module est actif.
// Sans `href`, l'écran n'existe pas encore : l'entrée est affichée « Bientôt ».

export type EntreeNav = {
  libelle: string;
  icone: LucideIcon;
  href?: string;
  permission?: string;
  module?: string;
};

export type GroupeNav = { titre: string | null; entrees: EntreeNav[] };

export const NAV: GroupeNav[] = [
  {
    titre: null,
    entrees: [{ libelle: "Tableau de bord", icone: LayoutDashboard, href: "/espace" }],
  },
  {
    titre: "Organisation",
    entrees: [
      { libelle: "Utilisateurs", icone: Users, permission: "utilisateurs.gerer", module: "utilisateurs" },
      { libelle: "Départements", icone: Building2, permission: "utilisateurs.departements", module: "utilisateurs" },
      { libelle: "Rôles et permissions", icone: ShieldCheck, permission: "roles.gerer", module: "roles" },
    ],
  },
  {
    titre: "Contenus",
    entrees: [
      { libelle: "Actualités", icone: Newspaper, permission: "actualites.publier", module: "actualites" },
      { libelle: "Annonces", icone: Megaphone, permission: "annonces.publier", module: "annonces" },
      { libelle: "Articles", icone: FileText, permission: "articles.publier", module: "articles" },
      { libelle: "Notes de service", icone: ScrollText, permission: "notes_service.publier", module: "notes_service" },
      { libelle: "Pages internes", icone: LayoutTemplate, permission: "pages.gerer", module: "pages" },
      { libelle: "Documents", icone: FolderOpen, permission: "documents.gerer", module: "documents" },
      { libelle: "Événements", icone: CalendarCheck, permission: "evenements.gerer", module: "evenements" },
      { libelle: "FAQ", icone: CircleHelp, permission: "faq.gerer", module: "faq" },
      { libelle: "Formulaires", icone: ClipboardList, permission: "formulaires.gerer", module: "formulaires" },
      { libelle: "Annuaire", icone: Contact, permission: "annuaire.gerer", module: "annuaire" },
    ],
  },
  {
    titre: "Configuration",
    entrees: [
      { libelle: "Modules", icone: Blocks, permission: "personnalisation.modules" },
      { libelle: "Apparence", icone: Palette, permission: "personnalisation.apparence" },
      { libelle: "Menus", icone: ListTree, permission: "personnalisation.menus" },
      { libelle: "Paramètres", icone: Settings, permission: "personnalisation.parametres" },
    ],
  },
];

// Menu filtré selon le profil ; les groupes vides disparaissent
export function menuPour(profil: Profil): GroupeNav[] {
  return NAV.map((g) => ({
    ...g,
    entrees: g.entrees.filter(
      (e) =>
        (!e.permission || profil.permissions.includes(e.permission)) &&
        (!e.module || profil.modules_actifs.includes(e.module)),
    ),
  })).filter((g) => g.entrees.length > 0);
}

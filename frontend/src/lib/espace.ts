import {
  Blocks,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  Contact,
  FileText,
  FolderOpen,
  Landmark,
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
  departement_id?: number | null;
  telephone?: string | null;
  poste?: string | null;
  photo?: string | null;
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
  // Entrée de la plateforme : visible uniquement par le Super-administrateur
  superAdmin?: boolean;
};

// Le Super-administrateur n'appartient à aucune entreprise
export const estSuperAdmin = (p: Pick<Profil, "role" | "entreprise">) => p.role === "Super-administrateur" && p.entreprise === null;

export type GroupeNav = { titre: string | null; entrees: EntreeNav[] };

export const NAV: GroupeNav[] = [
  {
    titre: null,
    entrees: [{ libelle: "Tableau de bord", icone: LayoutDashboard, href: "/espace" }],
  },
  {
    titre: "Organisation",
    entrees: [
      { libelle: "Utilisateurs", icone: Users, href: "/espace/utilisateurs", permission: "utilisateurs.gerer", module: "utilisateurs" },
      { libelle: "Départements", icone: Building2, href: "/espace/departements", permission: "utilisateurs.departements", module: "utilisateurs" },
      { libelle: "Rôles et permissions", icone: ShieldCheck, href: "/espace/roles", permission: "roles.gerer", module: "roles" },
    ],
  },
  {
    titre: "Contenus",
    entrees: [
      { libelle: "Actualités", icone: Newspaper, href: "/espace/actualites", permission: "actualites.publier", module: "actualites" },
      { libelle: "Annonces", icone: Megaphone, href: "/espace/annonces", permission: "annonces.publier", module: "annonces" },
      { libelle: "Articles", icone: FileText, href: "/espace/articles", permission: "articles.publier", module: "articles" },
      { libelle: "Notes de service", icone: ScrollText, href: "/espace/notes-service", permission: "notes_service.publier", module: "notes_service" },
      { libelle: "Pages internes", icone: LayoutTemplate, href: "/espace/pages-internes", permission: "pages.gerer", module: "pages" },
      { libelle: "Documents", icone: FolderOpen, href: "/espace/documents", permission: "documents.gerer", module: "documents" },
      { libelle: "Événements", icone: CalendarCheck, href: "/espace/evenements", permission: "evenements.gerer", module: "evenements" },
      { libelle: "FAQ", icone: CircleHelp, href: "/espace/faq", permission: "faq.gerer", module: "faq" },
      { libelle: "Formulaires", icone: ClipboardList, href: "/espace/formulaires", permission: "formulaires.gerer", module: "formulaires" },
      { libelle: "Annuaire", icone: Contact, href: "/espace/annuaire", permission: "annuaire.gerer", module: "annuaire" },
    ],
  },
  {
    titre: "Configuration",
    entrees: [
      { libelle: "Modules", icone: Blocks, href: "/espace/modules", permission: "personnalisation.modules" },
      { libelle: "Apparence", icone: Palette, href: "/espace/apparence", permission: "personnalisation.apparence" },
      { libelle: "Menus", icone: ListTree, permission: "personnalisation.menus" },
      { libelle: "Paramètres", icone: Settings, href: "/espace/parametres", permission: "personnalisation.parametres" },
    ],
  },
];

// Menu du Super-administrateur : il gère la plateforme, pas l'intranet d'une entreprise
export const NAV_PLATEFORME: GroupeNav[] = [
  {
    titre: null,
    entrees: [{ libelle: "Tableau de bord", icone: LayoutDashboard, href: "/espace", superAdmin: true }],
  },
  {
    titre: "Plateforme",
    entrees: [
      { libelle: "Intranets", icone: Landmark, href: "/espace/intranets", superAdmin: true },
      { libelle: "Catalogue de modules", icone: Blocks, href: "/espace/catalogue-modules", superAdmin: true },
    ],
  },
];

// Le rôle « RH » est créé avec chaque intranet ; il gère les personnes, pas la configuration
export const estRH = (p: Pick<Profil, "role" | "entreprise">) => p.role === "RH" && p.entreprise !== null;

// Le rôle « Manager » est créé avec chaque intranet ; il pilote une équipe et publie pour son département
export const estManager = (p: Pick<Profil, "role" | "entreprise">) => p.role === "Manager" && p.entreprise !== null;

// Entrées regroupées sous « Ressources humaines » dans le menu du rôle RH
const ENTREES_RH = ["Utilisateurs", "Départements", "Annuaire"];

// Menu filtré selon le profil ; les groupes vides disparaissent
export function menuPour(profil: Profil): GroupeNav[] {
  if (estSuperAdmin(profil)) return NAV_PLATEFORME;
  const groupes = NAV.map((g) => ({
    ...g,
    entrees: g.entrees.filter(
      (e) =>
        (!e.permission || profil.permissions.includes(e.permission)) &&
        (!e.module || profil.modules_actifs.includes(e.module)),
    ),
  })).filter((g) => g.entrees.length > 0);

  if (!estRH(profil)) return groupes;

  // RH : les écrans du personnel passent dans un groupe dédié, juste sous le tableau de bord
  const rh = groupes.flatMap((g) => g.entrees).filter((e) => ENTREES_RH.includes(e.libelle));
  if (rh.length === 0) return groupes;
  const autres = groupes
    .map((g) => ({ ...g, entrees: g.entrees.filter((e) => !ENTREES_RH.includes(e.libelle)) }))
    .filter((g) => g.entrees.length > 0);
  const [premier, ...suite] = autres;
  return [premier, { titre: "Ressources humaines", entrees: rh }, ...suite];
}

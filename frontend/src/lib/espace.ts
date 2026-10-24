import {
  Blocks,
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Contact,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  ListTree,
  Megaphone,
  Network,
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
  // Entrée masquée si le rôle a cette permission (ex. la consultation cède la place à la gestion)
  sauf?: string;
  // Code du module du menu configurable (« Menus ») dont dépend l'entrée, si différent de `module`
  menu?: string;
  // Jamais masquée par la configuration des menus : évite de s'enfermer dehors, et sert aux
  // modules que « Menus » ne règle pas (les pages se rangent par rubrique, /menu ne les renvoie pas)
  toujours?: boolean;
  // Lien vers un site externe : s'ouvre dans un nouvel onglet
  externe?: boolean;
};

// Réponse de GET /menu : réglages de l'administrateur appliqués au rôle de l'appelant
export type MenuConfig = {
  modules: {
    code: string;
    libelle: string;
    ordre: number;
    libelle_perso?: string | null;
    ordre_perso?: number | null;
  }[];
  liens: { id: number; libelle: string; url: string; ordre: number }[];
};

// Le Super-administrateur n'appartient à aucune entreprise
export const estSuperAdmin = (p: Pick<Profil, "role" | "entreprise">) =>
  p.role === "Super-administrateur" && p.entreprise === null;

export type GroupeNav = { titre: string | null; entrees: EntreeNav[] };

export const NAV: GroupeNav[] = [
  {
    titre: null,
    entrees: [
      { libelle: "Tableau de bord", icone: LayoutDashboard, href: "/espace" },
      // Fil d'actualité de l'entreprise : visible par tous les rôles d'une entreprise
      { libelle: "Accueil", icone: Home, href: "/espace/accueil" },
      // Formulaires internes à remplir : tout rôle qui a le droit de répondre
      {
        libelle: "Mes formulaires",
        icone: ClipboardCheck,
        href: "/espace/mes-formulaires",
        permission: "formulaires.repondre",
        module: "formulaires",
      },
    ],
  },
  {
    titre: "Mon entreprise",
    entrees: [
      {
        libelle: "Annuaire",
        icone: Contact,
        href: "/espace/consulter-annuaire",
        permission: "annuaire.consulter",
        module: "annuaire",
        sauf: "annuaire.gerer",
      },
      {
        libelle: "Organigramme",
        icone: Network,
        href: "/espace/organigramme",
        permission: "annuaire.consulter",
        module: "annuaire",
        sauf: "annuaire.gerer",
      },
      {
        libelle: "Calendrier",
        icone: CalendarDays,
        href: "/espace/calendrier",
        permission: "evenements.consulter",
        module: "evenements",
        menu: "calendrier",
        sauf: "evenements.gerer",
      },
      {
        libelle: "Pages internes",
        icone: LayoutTemplate,
        href: "/espace/consulter-pages",
        permission: "pages.consulter",
        module: "pages",
        sauf: "pages.gerer",
        toujours: true,
      },
      {
        libelle: "Documents",
        icone: FolderOpen,
        href: "/espace/consulter-documents",
        permission: "documents.consulter",
        module: "documents",
        sauf: "documents.gerer",
      },
      {
        libelle: "FAQ",
        icone: CircleHelp,
        href: "/espace/consulter-faq",
        permission: "faq.consulter",
        module: "faq",
        sauf: "faq.gerer",
      },
    ],
  },
  {
    titre: "Organisation",
    entrees: [
      {
        libelle: "Utilisateurs",
        icone: Users,
        href: "/espace/utilisateurs",
        permission: "utilisateurs.gerer",
        module: "utilisateurs",
      },
      {
        libelle: "Départements",
        icone: Building2,
        href: "/espace/departements",
        permission: "utilisateurs.departements",
        module: "utilisateurs",
      },
      {
        libelle: "Rôles et permissions",
        icone: ShieldCheck,
        href: "/espace/roles",
        permission: "roles.gerer",
        module: "roles",
      },
    ],
  },
  {
    titre: "Contenus",
    entrees: [
      {
        libelle: "Actualités",
        icone: Newspaper,
        href: "/espace/actualites",
        permission: "actualites.publier",
        module: "actualites",
      },
      {
        libelle: "Annonces",
        icone: Megaphone,
        href: "/espace/annonces",
        permission: "annonces.publier",
        module: "annonces",
      },
      {
        libelle: "Articles",
        icone: FileText,
        href: "/espace/articles",
        permission: "articles.publier",
        module: "articles",
      },
      {
        libelle: "Notes de service",
        icone: ScrollText,
        href: "/espace/notes-service",
        permission: "notes_service.publier",
        module: "notes_service",
      },
      {
        libelle: "Pages internes",
        icone: LayoutTemplate,
        href: "/espace/pages-internes",
        permission: "pages.gerer",
        module: "pages",
        toujours: true,
      },
      {
        libelle: "Documents",
        icone: FolderOpen,
        href: "/espace/documents",
        permission: "documents.gerer",
        module: "documents",
      },
      {
        libelle: "Événements",
        icone: CalendarCheck,
        href: "/espace/evenements",
        permission: "evenements.gerer",
        module: "evenements",
      },
      { libelle: "FAQ", icone: CircleHelp, href: "/espace/faq", permission: "faq.gerer", module: "faq" },
      {
        libelle: "Formulaires",
        icone: ClipboardList,
        href: "/espace/formulaires",
        permission: "formulaires.gerer",
        module: "formulaires",
      },
      {
        libelle: "Annuaire",
        icone: Contact,
        href: "/espace/annuaire",
        permission: "annuaire.gerer",
        module: "annuaire",
      },
    ],
  },
  {
    titre: "Configuration",
    entrees: [
      {
        libelle: "Modules",
        icone: Blocks,
        href: "/espace/modules",
        permission: "personnalisation.modules",
        menu: "personnalisation",
      },
      {
        libelle: "Apparence",
        icone: Palette,
        href: "/espace/apparence",
        permission: "personnalisation.apparence",
        menu: "personnalisation",
      },
      {
        libelle: "Menus",
        icone: ListTree,
        href: "/espace/menus",
        permission: "personnalisation.parametres",
        menu: "personnalisation",
        toujours: true,
      },
      {
        libelle: "Paramètres",
        icone: Settings,
        href: "/espace/parametres",
        permission: "personnalisation.parametres",
        menu: "personnalisation",
      },
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
export function menuPour(profil: Profil, menu: MenuConfig | null = null): GroupeNav[] {
  if (estSuperAdmin(profil)) return NAV_PLATEFORME;
  const base = menuDeBase(profil);
  return menu ? appliquerMenu(base, menu) : base;
}

const cleMenu = (e: EntreeNav) => e.menu ?? e.module;

// Réglages de l'administrateur (écran « Menus ») : visibilité et rôles, libellés, ordre, liens
function appliquerMenu(groupes: GroupeNav[], menu: MenuConfig): GroupeNav[] {
  const modules = new Map(menu.modules.map((m) => [m.code, m]));
  const reglage = (e: EntreeNav) => {
    const c = cleMenu(e);
    return c ? modules.get(c) : undefined;
  };

  // 1. Une entrée liée à un module que /menu ne renvoie pas pour ce rôle est masquée
  let res = groupes
    .map((g) => ({ ...g, entrees: g.entrees.filter((e) => !cleMenu(e) || e.toujours || modules.has(cleMenu(e)!)) }))
    .filter((g) => g.entrees.length > 0);

  // 2. Libellé personnalisé : seulement si le module n'a qu'une entrée dans le menu
  const nb = new Map<string, number>();
  for (const g of res)
    for (const e of g.entrees) {
      const c = cleMenu(e);
      if (c) nb.set(c, (nb.get(c) ?? 0) + 1);
    }
  res = res.map((g) => ({
    ...g,
    entrees: g.entrees.map((e) => {
      const r = reglage(e);
      return r?.libelle_perso && nb.get(cleMenu(e)!) === 1 ? { ...e, libelle: r.libelle_perso } : e;
    }),
  }));

  // 3. Ordre : un groupe où l'administrateur a réglé l'ordre se trie sur l'ordre des modules
  //    (les entrées sans module, comme le tableau de bord, restent en tête)
  res = res.map((g) => {
    if (!g.entrees.some((e) => reglage(e)?.ordre_perso != null)) return g;
    const rang = (e: EntreeNav) => (cleMenu(e) ? (reglage(e)?.ordre ?? Number.MAX_SAFE_INTEGER) : -1);
    return { ...g, entrees: [...g.entrees].sort((a, b) => rang(a) - rang(b)) };
  });

  // 4. Liens personnalisés, dans un groupe à la fin
  if (menu.liens.length > 0) {
    res = [
      ...res,
      {
        titre: "Liens",
        entrees: menu.liens.map((l) => {
          const externe = l.url.startsWith("https://");
          return { libelle: l.libelle, icone: externe ? ExternalLink : Link2, href: l.url, externe };
        }),
      },
    ];
  }
  return res;
}

function menuDeBase(profil: Profil): GroupeNav[] {
  const groupes = NAV.map((g) => ({
    ...g,
    entrees: g.entrees.filter(
      (e) =>
        (!e.permission || profil.permissions.includes(e.permission)) &&
        (!e.module || profil.modules_actifs.includes(e.module)) &&
        (!e.sauf || !profil.permissions.includes(e.sauf)),
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

// ---- Garde de route ------------------------------------------------------------
// Une adresse du menu n'est ouverte que si son entrée l'est : même règle que le menu latéral
// (permission, module actif, réglages de « Menus »). L'API reste l'arbitre final des droits.

export type RaisonRefus = "role" | "module" | "menu";

type EntreeAdressee = EntreeNav & { href: string };

const ENTREES_ADRESSEES: EntreeAdressee[] = [...NAV, ...NAV_PLATEFORME]
  .flatMap((g) => g.entrees)
  .filter((e): e is EntreeAdressee => !!e.href && e.href !== "/espace");

// null = accès permis. Les adresses hors menu (tableau de bord, inconnues) restent permises ici.
export function refusRoute(chemin: string, profil: Profil, menu: MenuConfig | null): RaisonRefus | null {
  const adresse = chemin.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const entree = ENTREES_ADRESSEES.filter((e) => adresse === e.href || adresse.startsWith(`${e.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  if (!entree) return null;

  // La plateforme et les intranets sont deux mondes : le Super-administrateur n'ouvre que les écrans de la plateforme
  if (estSuperAdmin(profil) !== !!entree.superAdmin) return "role";
  if (entree.superAdmin) return null;

  if (entree.permission && !profil.permissions.includes(entree.permission)) return "role";
  if (entree.module && !profil.modules_actifs.includes(entree.module)) return "module";

  // Masquée par l'administrateur (écran « Menus ») pour ce rôle ; sans réponse de /menu, on ne bloque pas
  const cle = cleMenu(entree);
  if (menu && cle && !entree.toujours && !menu.modules.some((m) => m.code === cle)) return "menu";
  return null;
}

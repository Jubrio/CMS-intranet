import { api } from "@/lib/api";

export type ModuleCatalogue = {
  code_module: string;
  nom_module: string;
  description_module: string;
  module_obligatoire: boolean;
};

export const MODULES_PAR_DEFAUT: ModuleCatalogue[] = [
  {
    code_module: "utilisateurs",
    nom_module: "Utilisateurs",
    description_module: "Comptes, services et départements",
    module_obligatoire: true,
  },
  {
    code_module: "roles",
    nom_module: "Rôles et permissions",
    description_module: "Gestion des rôles et des droits",
    module_obligatoire: true,
  },
  {
    code_module: "personnalisation",
    nom_module: "Personnalisation",
    description_module: "Paramètres, menus, apparence et choix des modules",
    module_obligatoire: true,
  },
  {
    code_module: "actualites",
    nom_module: "Actualités",
    description_module: "Actualités de l'entreprise",
    module_obligatoire: false,
  },
  {
    code_module: "annonces",
    nom_module: "Annonces",
    description_module: "Annonces internes",
    module_obligatoire: false,
  },
  {
    code_module: "annuaire",
    nom_module: "Annuaire et organigramme",
    description_module: "Fiches des employés et organigramme",
    module_obligatoire: false,
  },
  {
    code_module: "articles",
    nom_module: "Articles",
    description_module: "Articles et publications",
    module_obligatoire: false,
  },
  {
    code_module: "calendrier",
    nom_module: "Calendrier",
    description_module: "Calendrier de l'entreprise",
    module_obligatoire: false,
  },
  {
    code_module: "documents",
    nom_module: "Documents",
    description_module: "Partage de documents",
    module_obligatoire: false,
  },
  {
    code_module: "evenements",
    nom_module: "Événements",
    description_module: "Événements internes",
    module_obligatoire: false,
  },
  { code_module: "faq", nom_module: "FAQ", description_module: "Questions fréquentes", module_obligatoire: false },
  {
    code_module: "formulaires",
    nom_module: "Formulaires internes",
    description_module: "Formulaires à remplir",
    module_obligatoire: false,
  },
  {
    code_module: "notes_service",
    nom_module: "Notes de service",
    description_module: "Notes de service officielles",
    module_obligatoire: false,
  },
  {
    code_module: "pages",
    nom_module: "Pages internes",
    description_module: "Pages d'information",
    module_obligatoire: false,
  },
];

export async function getCatalogue(): Promise<ModuleCatalogue[]> {
  try {
    const data = await api<ModuleCatalogue[]>("/modules/catalogue", { next: { revalidate: 300 } });
    return Array.isArray(data) && data.length > 0 ? data : MODULES_PAR_DEFAUT;
  } catch {
    return MODULES_PAR_DEFAUT;
  }
}

"use client";

import { estManager, estRH, estSuperAdmin } from "@/lib/espace";
import { useEspace } from "./espace-context";
import { EmployeTableauDeBord } from "./employe-tableau-de-bord";
import { TableauDeBord } from "./tableau-de-bord";
import { TableauDeBordManager } from "./tableau-de-bord-manager";
import { TableauDeBordPlateforme } from "./tableau-de-bord-plateforme";
import { TableauDeBordRH } from "./tableau-de-bord-rh";

// Accueil de l'espace : chaque profil arrive sur son tableau de bord.
// Le super-administrateur voit celui de la plateforme, le rôle RH celui des effectifs,
// le Manager celui de son équipe, l'Employé le sien, les autres celui de leur entreprise.
export function Accueil() {
  const { profil } = useEspace();
  if (estSuperAdmin(profil)) return <TableauDeBordPlateforme />;
  // Le tableau RH lit /rh/tableau-de-bord : il exige la permission de gérer les utilisateurs
  if (estRH(profil) && profil.permissions.includes("utilisateurs.gerer")) return <TableauDeBordRH />;
  if (estManager(profil)) return <TableauDeBordManager />;
  if (profil.role === "Employé" && profil.entreprise !== null) return <EmployeTableauDeBord />;
  return <TableauDeBord />;
}

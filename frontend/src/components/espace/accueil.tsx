"use client";

import { estManager, estRH, estSuperAdmin } from "@/lib/espace";
import { useEspace } from "./espace-context";
import { EmployeTableauDeBord } from "./employe-tableau-de-bord";
import { TableauDeBord } from "./tableau-de-bord";
import { TableauDeBordManager } from "./tableau-de-bord-manager";
import { TableauDeBordPlateforme } from "./tableau-de-bord-plateforme";
import { TableauDeBordRH } from "./tableau-de-bord-rh";

export function Accueil() {
  const { profil } = useEspace();
  if (estSuperAdmin(profil)) return <TableauDeBordPlateforme />;
  if (estRH(profil) && profil.permissions.includes("utilisateurs.gerer")) return <TableauDeBordRH />;
  if (estManager(profil)) return <TableauDeBordManager />;
  if (profil.role === "Employé" && profil.entreprise !== null) return <EmployeTableauDeBord />;
  return <TableauDeBord />;
}

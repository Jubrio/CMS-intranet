"use client";

import { createContext, useContext } from "react";
import type { Personnalisation, Profil } from "@/lib/espace";

type Valeur = {
  profil: Profil;
  perso: Personnalisation | null;
  token: string;
  // Session expirée : efface le jeton et renvoie vers la connexion
  expirer: () => void;
  // Recharge le profil (menu, modules actifs) après un changement de configuration
  actualiser: () => Promise<void>;
  // Remplace la personnalisation (logo, couleurs) après une modification
  majPerso: (perso: Personnalisation) => void;
};

export const EspaceContext = createContext<Valeur | null>(null);

export function useEspace(): Valeur {
  const valeur = useContext(EspaceContext);
  if (!valeur) throw new Error("useEspace doit être utilisé dans <EspaceShell>.");
  return valeur;
}

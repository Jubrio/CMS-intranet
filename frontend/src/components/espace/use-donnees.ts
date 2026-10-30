"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useEspace } from "./espace-context";

export function useDonnees<T>(actif: boolean, charger: (token: string) => Promise<T>) {
  const { token, expirer } = useEspace();
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(actif);
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    charger(token)
      .then((d) => {
        if (annule) return;
        setDonnees(d);
        setErreur(false);
        setChargement(false);
      })
      .catch((err) => {
        if (annule) return;
        if (err instanceof ApiError && err.status === 401) {
          expirer();
          return;
        }
        setErreur(true);
        setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [actif, charger, token, expirer, essai]);

  const reessayer = useCallback(() => {
    setErreur(false);
    setChargement(true);
    setEssai((n) => n + 1);
  }, []);

  return { donnees, chargement, erreur, reessayer };
}

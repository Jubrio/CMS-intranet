"use client";

import { useCallback, useEffect, useState } from "react";
import { Saisie } from "./champs";

// Champ du code à 6 chiffres reçu par e-mail : chiffres seulement, saisie ou collage.
export function SaisieCode({
  id,
  value,
  onChange,
  erreur,
}: {
  id: string;
  value: string;
  onChange: (valeur: string) => void;
  erreur?: string;
}) {
  return (
    <Saisie
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      erreur={erreur}
      className="text-center font-mono text-xl tracking-[0.5em]"
    />
  );
}

// Compte à rebours avant de pouvoir demander un nouveau code (le serveur impose 1 envoi par minute).
export function useDelaiRenvoi(secondes = 60) {
  const [reste, setReste] = useState(0);

  useEffect(() => {
    if (reste <= 0) return;
    const minuteur = setTimeout(() => setReste((r) => r - 1), 1000);
    return () => clearTimeout(minuteur);
  }, [reste]);

  const demarrer = useCallback(() => setReste(secondes), [secondes]);
  return { reste, demarrer };
}

"use client";

import { useEffect, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { INACTIVITE_MINUTES, SIGNAL_ACTIVITE_MINUTES } from "@/lib/inactivite";

const EVENEMENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;

/**
 * Déconnecte l'utilisateur après INACTIVITE_MINUTES sans action. Tant qu'il est actif, un signal léger
 * (/me) est envoyé au plus toutes les SIGNAL_ACTIVITE_MINUTES minutes pour que le serveur,
 * qui applique la même règle, ne ferme pas la session d'une personne qui lit sans appeler l'API.
 */
export function useInactivite(token: string | undefined, surInactivite: () => void, surSessionPerdue: () => void) {
  const derniereAction = useRef(0);
  const dernierSignal = useRef(0);
  const callbacks = useRef({ surInactivite, surSessionPerdue });

  useEffect(() => {
    callbacks.current = { surInactivite, surSessionPerdue };
  });

  useEffect(() => {
    if (!token || INACTIVITE_MINUTES <= 0) return;
    derniereAction.current = Date.now();
    dernierSignal.current = Date.now();

    const noter = () => {
      derniereAction.current = Date.now();
    };
    for (const e of EVENEMENTS) window.addEventListener(e, noter, { passive: true });

    const minuteur = setInterval(() => {
      const maintenant = Date.now();
      if (maintenant - derniereAction.current >= INACTIVITE_MINUTES * 60_000) {
        callbacks.current.surInactivite();
        return;
      }
      const actifDepuisLeSignal = derniereAction.current > dernierSignal.current;
      if (actifDepuisLeSignal && maintenant - dernierSignal.current >= SIGNAL_ACTIVITE_MINUTES * 60_000) {
        dernierSignal.current = maintenant;
        api("/me", { token }).catch((err) => {
          if (err instanceof ApiError && err.status === 401) callbacks.current.surSessionPerdue();
        });
      }
    }, 15_000);

    return () => {
      clearInterval(minuteur);
      for (const e of EVENEMENTS) window.removeEventListener(e, noter);
    };
  }, [token]);
}

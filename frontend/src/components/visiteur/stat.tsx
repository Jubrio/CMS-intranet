"use client";

import { useEffect, useRef, useState } from "react";

export function Compteur({ cible }: { cible: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [valeur, setValeur] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let minuteur: ReturnType<typeof setInterval> | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (reduit) {
          setValeur(cible);
          return;
        }
        const pas = Math.max(1, Math.ceil(cible / 30));
        let courant = 0;
        minuteur = setInterval(() => {
          courant = Math.min(cible, courant + pas);
          setValeur(courant);
          if (courant >= cible) clearInterval(minuteur);
        }, 35);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (minuteur) clearInterval(minuteur);
    };
  }, [cible]);

  return (
    <span ref={ref} className="font-display text-2xl font-bold text-site-ink">
      {valeur.toLocaleString("fr-FR")}
    </span>
  );
}

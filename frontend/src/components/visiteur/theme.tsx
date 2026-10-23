"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const CLE = "visiteur-theme";
const abonnes = new Set<() => void>();

// Le thème vit dans l'attribut data-visiteur-theme de <html> (posé avant le
// premier affichage par le script du layout). Sombre = attribut absent ou "dark".
function abonner(cb: () => void) {
  abonnes.add(cb);
  return () => {
    abonnes.delete(cb);
  };
}
const lire = (): Theme => (document.documentElement.dataset.visiteurTheme === "light" ? "light" : "dark");
const lireServeur = (): Theme => "dark";

function appliquer(theme: Theme, memoriser: boolean) {
  document.documentElement.dataset.visiteurTheme = theme;
  if (memoriser) {
    try {
      localStorage.setItem(CLE, theme);
    } catch {
      // stockage indisponible : le choix vaut pour cette visite seulement
    }
  }
  abonnes.forEach((cb) => cb());
}

// Enveloppe de toutes les pages visiteur. Tant qu'elle est montée, les
// couleurs du site (variables --site-*) sont actives ; en la quittant on
// retire l'attribut, pour ne pas toucher à l'application connectée.
export function VisiteurShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const memorise = localStorage.getItem(CLE);
      if ((memorise === "light" || memorise === "dark") && memorise !== lire()) {
        appliquer(memorise, false);
      }
    } catch {
      // stockage indisponible
    }
    return () => {
      delete document.documentElement.dataset.visiteurTheme;
    };
  }, []);

  return <div className="visiteur min-h-screen bg-site-base text-site-ink antialiased">{children}</div>;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(abonner, lire, lireServeur);
  const sombre = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => appliquer(sombre ? "light" : "dark", true)}
      aria-label={sombre ? "Passer au thème clair" : "Passer au thème sombre"}
      title={sombre ? "Thème clair" : "Thème sombre"}
      className={`inline-flex size-10 items-center justify-center rounded-full border border-site-line text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink ${className}`}
    >
      {sombre ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
}

"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const CLE = "visiteur-theme";
const abonnes = new Set<() => void>();

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
      // stockage indisponible
    }
  }
  abonnes.forEach((cb) => cb());
}

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

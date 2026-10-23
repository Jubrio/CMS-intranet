"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { initiales, type Personnalisation, type Profil } from "@/lib/espace";
import { effacerToken, lireToken } from "@/lib/session";
import { ThemeToggle } from "@/components/visiteur/theme";
import { EspaceContext } from "./espace-context";
import { Sidebar } from "./sidebar";

type Session = { token: string; profil: Profil; perso: Personnalisation | null };

export function EspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [erreur, setErreur] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  const expirer = useCallback(() => {
    effacerToken();
    router.replace("/connexion");
  }, [router]);

  useEffect(() => {
    const token = lireToken();
    if (!token) {
      router.replace("/connexion");
      return;
    }
    let annule = false;
    Promise.all([
      api<Profil>("/me", { token }),
      // La personnalisation est un plus (logo, nom) : son échec ne bloque pas l'espace
      api<Personnalisation>("/personnalisation", { token }).catch(() => null),
    ])
      .then(([profil, perso]) => {
        if (!annule) setSession({ token, profil, perso });
      })
      .catch((err) => {
        if (annule) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) expirer();
        else setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [router, expirer]);

  // Le tiroir mobile se ferme avec Échap
  useEffect(() => {
    if (!menuOuvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setMenuOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [menuOuvert]);

  async function deconnecter() {
    try {
      await api("/logout", { method: "POST", token: session?.token });
    } catch {
      // le jeton local est supprimé dans tous les cas
    }
    effacerToken();
    router.replace("/");
  }

  const valeur = useMemo(() => (session ? { ...session, expirer } : null), [session, expirer]);

  if (erreur) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8 text-sm text-site-muted">
        Impossible de charger votre espace. Vérifiez votre connexion et rechargez la page.
      </main>
    );
  }

  if (!session || !valeur) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Chargement">
        <span className="size-8 animate-spin rounded-full border-2 border-site-line border-t-brand-violet" />
      </div>
    );
  }

  const { profil, perso } = session;

  return (
    <EspaceContext.Provider value={valeur}>
      {/* Menu latéral (bureau) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-site-line bg-site-surface lg:block">
        <Sidebar profil={profil} perso={perso} />
      </aside>

      {/* Tiroir (mobile) */}
      {menuOuvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOuvert(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-site-line bg-site-surface shadow-2xl">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setMenuOuvert(false)}
              className="absolute right-3 top-3.5 z-10 inline-flex size-9 items-center justify-center rounded-full text-site-muted hover:bg-site-surface2 hover:text-site-ink"
            >
              <X size={18} />
            </button>
            <Sidebar profil={profil} perso={perso} onNavigate={() => setMenuOuvert(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="v-glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-site-line px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setMenuOuvert(true)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-site-line text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Administration</p>
            <p className="hidden truncate text-xs text-site-muted sm:block">{perso?.nom_entreprise ?? profil.entreprise}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span aria-hidden className="hidden h-6 w-px bg-site-line sm:block" />
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="v-gradient-btn flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              >
                {initiales(profil)}
              </span>
              <div className="hidden min-w-0 leading-tight md:block">
                <p className="truncate text-sm font-medium">
                  {profil.prenom} {profil.nom}
                </p>
                <p className="truncate text-xs text-site-muted">{profil.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={deconnecter}
              title="Se déconnecter"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-site-line px-3 text-sm text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink sm:px-4"
            >
              <LogOut size={16} aria-hidden />
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sr-only sm:hidden">Se déconnecter</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </EspaceContext.Provider>
  );
}

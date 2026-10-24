"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { estSuperAdmin, refusRoute, type MenuConfig, type Personnalisation, type Profil } from "@/lib/espace";
import { variablesTheme } from "@/lib/apparence";
import { effacerToken, lireToken } from "@/lib/session";
import { ThemeToggle } from "@/components/visiteur/theme";
import { EspaceContext } from "./espace-context";
import { Sidebar } from "./sidebar";
import { AccesRefuse } from "./acces-refuse";
import { PastilleProfil, ProfilPanneau } from "./profil-panneau";
import { NotificationsCloche } from "./notifications-cloche";

type Session = { token: string; profil: Profil; perso: Personnalisation | null; menu: MenuConfig | null };

export function EspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [erreur, setErreur] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const fermerProfil = useCallback(() => setProfilOuvert(false), []);

  const expirer = useCallback(() => {
    effacerToken();
    router.replace("/connexion");
  }, [router]);

  const majPerso = useCallback((perso: Personnalisation) => {
    setSession((s) => (s ? { ...s, perso } : s));
  }, []);

  const jeton = session?.token;
  const actualiser = useCallback(async () => {
    if (!jeton) return;
    try {
      const [profil, menu] = await Promise.all([
        api<Profil>("/me", { token: jeton }),
        // Les réglages du menu sont un plus : sans eux, le menu par défaut s'affiche
        api<MenuConfig>("/menu", { token: jeton }).catch(() => null),
      ]);
      setSession((s) => (s ? { ...s, profil, menu } : s));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) expirer();
    }
  }, [jeton, expirer]);

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
      api<MenuConfig>("/menu", { token }).catch(() => null),
    ])
      .then(([profil, perso, menu]) => {
        if (!annule) setSession({ token, profil, perso, menu });
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

  // La confirmation de déconnexion se ferme avec Échap
  useEffect(() => {
    if (!confirmerDeconnexion || deconnexionEnCours) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setConfirmerDeconnexion(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [confirmerDeconnexion, deconnexionEnCours]);

  async function deconnecter() {
    setDeconnexionEnCours(true);
    try {
      await api("/logout", { method: "POST", token: session?.token });
    } catch {
      // le jeton local est supprimé dans tous les cas
    }
    effacerToken();
    router.replace("/");
  }

  const valeur = useMemo(
    () => (session ? { ...session, expirer, actualiser, majPerso } : null),
    [session, expirer, actualiser, majPerso],
  );

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

  const { profil, perso, menu } = session;
  // Garde de route : une page dont l'entrée de menu n'est pas ouverte à ce profil ne se charge pas
  const refus = refusRoute(pathname, profil, menu);

  return (
    <EspaceContext.Provider value={valeur}>
      {/* Couleurs de l'entreprise : les variables s'appliquent à tout l'espace sans ajouter de boîte */}
      <div className="contents" style={variablesTheme(perso?.couleur_principale, perso?.couleur_secondaire)}>
        {/* Menu latéral (bureau) */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-site-line bg-site-surface lg:block">
          <Sidebar profil={profil} perso={perso} menu={menu} />
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
              <Sidebar profil={profil} perso={perso} menu={menu} onNavigate={() => setMenuOuvert(false)} />
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
              <p className="hidden truncate text-xs text-site-muted sm:block">
                {perso?.nom_entreprise ?? profil.entreprise}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Le Super-administrateur n'appartient à aucune entreprise : pas de notifications */}
              {!estSuperAdmin(profil) && <NotificationsCloche />}
              <ThemeToggle />
              <span aria-hidden className="hidden h-6 w-px bg-site-line sm:block" />
              <button
                type="button"
                onClick={() => setProfilOuvert(true)}
                aria-haspopup="dialog"
                title="Mon profil"
                className="flex items-center gap-3 rounded-full py-1 pl-1 pr-1 text-left transition-colors hover:bg-site-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40 md:pr-4"
              >
                <PastilleProfil profil={profil} />
                <div className="hidden min-w-0 leading-tight md:block">
                  <p className="truncate text-sm font-medium">
                    {profil.prenom} {profil.nom}
                  </p>
                  <p className="truncate text-xs text-site-muted">{profil.role}</p>
                </div>
                <span className="sr-only">Ouvrir mon profil</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmerDeconnexion(true)}
                aria-haspopup="dialog"
                title="Se déconnecter"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-site-line px-3 text-sm text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink sm:px-4"
              >
                <LogOut size={16} aria-hidden />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sr-only sm:hidden">Se déconnecter</span>
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">
            {refus ? <AccesRefuse raison={refus} /> : children}
          </main>
        </div>

        {profilOuvert && <ProfilPanneau onFermer={fermerProfil} />}

        {/* Confirmation avant de quitter la session */}
        {confirmerDeconnexion && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titre-deconnexion"
          >
            <button
              type="button"
              aria-label="Annuler"
              disabled={deconnexionEnCours}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmerDeconnexion(false)}
            />
            <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
              <h2 id="titre-deconnexion" className="flex items-start gap-2 font-display text-base font-semibold">
                <LogOut size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-violet" />
                Voulez-vous vous déconnecter ?
              </h2>
              <p className="mt-2 text-sm text-site-muted">
                Vous quitterez votre espace et devrez vous reconnecter pour y revenir.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  autoFocus
                  disabled={deconnexionEnCours}
                  onClick={() => setConfirmerDeconnexion(false)}
                  className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={deconnexionEnCours}
                  onClick={deconnecter}
                  className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
                >
                  {deconnexionEnCours ? "Déconnexion…" : "Se déconnecter"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EspaceContext.Provider>
  );
}

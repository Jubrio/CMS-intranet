"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type LucideIcon,
  Archive,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderTree,
  LayoutTemplate,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import type { DepartementOption } from "./contenu-formulaire";
import { PageFormulaire, type PageInterne, type StatutPage } from "./page-formulaire";

type Pagination<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

const nombre = new Intl.NumberFormat("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const STATUTS: { code: StatutPage; libelle: string; vide: string; icone: LucideIcon }[] = [
  { code: "publie", libelle: "Publiées", vide: "Aucune page publiée pour le moment.", icone: LayoutTemplate },
  { code: "brouillon", libelle: "Brouillons", vide: "Aucun brouillon en cours.", icone: FileText },
  { code: "archive", libelle: "Archivées", vide: "Aucune page archivée.", icone: Archive },
];

function Ico({ de, size }: { de: LucideIcon; size: number }) {
  const Composant = de;
  return <Composant size={size} aria-hidden />;
}

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function BoutonIcone({
  libelle,
  onClick,
  disabled,
  danger,
  children,
}: {
  libelle: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors disabled:pointer-events-none disabled:opacity-40",
        danger ? "hover:bg-site-danger/10 hover:text-site-danger" : "hover:bg-site-surface2 hover:text-site-ink",
      )}
    >
      {children}
    </button>
  );
}

const COLONNES = "md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem]";

export function PagesInternes() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("pages.gerer");
  const peutListerDepartements = profil.permissions.includes("utilisateurs.departements");

  const [statut, setStatut] = useState<StatutPage>("publie");
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [formulaire, setFormulaire] = useState<{ page: PageInterne | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<PageInterne | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Liste de l'onglet courant
  const cleCourante = `${statut}|${page}|${q}|${version}`;
  const chargerListe = useCallback(
    async (jeton: string) => {
      const p = new URLSearchParams({ statut, page: String(page) });
      if (q) p.set("q", q);
      const res = await api<Pagination<PageInterne>>(`/pages?${p.toString()}`, { token: jeton });
      // Dernière page vidée (ex. dernière page archivée) : on recule jusqu'à la dernière page existante
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [statut, page, q, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;

  // Compteurs des trois onglets (hors recherche)
  const chargerTotaux = useCallback(
    async (jeton: string) => {
      void version;
      const [publie, brouillon, archive] = await Promise.all(
        STATUTS.map((s) => api<{ total: number }>(`/pages?statut=${s.code}`, { token: jeton })),
      );
      return { publie: publie.total, brouillon: brouillon.total, archive: archive.total } as Record<StatutPage, number>;
    },
    [version],
  );
  const totaux = useDonnees(autorise, chargerTotaux);

  // Départements : liste complète si le rôle y a accès ; sinon le département de l'utilisateur
  const chargerDepartements = useCallback(
    async (jeton: string) => api<DepartementOption[]>("/departements", { token: jeton }),
    [],
  );
  const deps = useDonnees(autorise && peutListerDepartements, chargerDepartements);
  const departements = useMemo<DepartementOption[]>(() => {
    if (deps.donnees) return deps.donnees;
    if (profil.departement_id) return [{ id: profil.departement_id, nom_departement: "Mon département" }];
    return [];
  }, [deps.donnees, profil.departement_id]);
  const nomDepartement = (id: number | null) =>
    departements.find((d) => d.id === id)?.nom_departement ?? "Un département";

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function apresEnregistrement(texte: string, options?: { echecPublication?: string; rouvrir?: PageInterne }) {
    // Page créée en brouillon : on reste dans le panneau, en mode modification, pour ajouter des images
    setFormulaire(options?.rouvrir ? { page: options.rouvrir } : null);
    setNotice(
      options?.echecPublication
        ? { type: "erreur", texte: `${texte} La publication a échoué : ${options.echecPublication}` }
        : { type: "ok", texte },
    );
    setVersion((v) => v + 1);
  }

  async function action(p: PageInterne, chemin: "publier" | "archiver", succes: string) {
    setEnCoursId(p.id);
    try {
      await api<PageInterne>(`/pages/${p.id}/${chemin}`, { method: "POST", token });
      setNotice({ type: "ok", texte: succes });
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCoursId(null);
    }
  }

  async function supprimer(p: PageInterne) {
    setASupprimer(null);
    setEnCoursId(p.id);
    try {
      await api<{ message: string }>(`/pages/${p.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: `La page « ${p.titre} » a été supprimée.` });
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCoursId(null);
    }
  }

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Vous n’avez pas accès à la gestion des pages internes.
      </p>
    );
  }

  const courant = STATUTS.find((s) => s.code === statut)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Pages internes</h1>
          <p className="mt-1 text-sm text-site-muted">
            Créez les pages d’information de l’intranet et rangez-les par rubrique du menu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ page: null })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Nouvelle page
        </button>
      </div>

      {notice && (
        <p
          role={notice.type === "erreur" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok"
              ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
              : "border-site-danger/40 bg-site-danger/10 text-site-danger",
          )}
        >
          {notice.texte}
          <button
            type="button"
            aria-label="Masquer le message"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={16} aria-hidden />
          </button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {STATUTS.map(({ code, libelle, icone }) => {
          const actif = statut === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={actif}
              onClick={() => {
                setStatut(code);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-4 rounded-2xl border bg-site-surface p-4 text-left shadow-sm transition-colors",
                actif
                  ? "border-brand-violet ring-1 ring-brand-violet/40"
                  : "border-site-line hover:border-brand-violet/50",
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                <Ico de={icone} size={20} />
              </span>
              <span>
                <span className="block text-xs font-medium text-site-muted">{libelle}</span>
                {totaux.donnees ? (
                  <span className="block font-display text-2xl font-bold leading-tight tabular-nums">
                    {nombre.format(totaux.donnees[code])}
                  </span>
                ) : (
                  <Squelette className="mt-1.5 h-6 w-12" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="border-b border-site-line p-4">
          <div className="relative max-w-md">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted"
            />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Rechercher par titre"
              aria-label="Rechercher une page par titre"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
        </div>

        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger les pages.</span>
            <button
              type="button"
              onClick={liste.reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : enChargement ? (
          <ul className="divide-y divide-site-line" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Squelette className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-56" />
                  <Squelette className="h-3 w-40" />
                </div>
              </li>
            ))}
          </ul>
        ) : !res || res.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <Ico de={courant.icone} size={22} />
            </span>
            <p className="mt-4 text-sm font-medium">
              {q ? "Aucune page ne correspond à cette recherche." : courant.vide}
            </p>
            {!q && statut === "publie" && (
              <p className="mt-1 text-xs text-site-muted">
                Créez une page, puis publiez-la pour qu’elle apparaisse dans le menu.
              </p>
            )}
          </div>
        ) : (
          <div>
            <div
              className={cn(
                "hidden gap-4 border-b border-site-line px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-site-muted md:grid",
                COLONNES,
              )}
            >
              <span>Page</span>
              <span>Destinataires</span>
              <span>{statut === "brouillon" ? "Statut" : "Publication"}</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-site-line">
              {res.data.map((p) => {
                const occupe = enCoursId === p.id;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-site-surface2/50",
                      COLONNES,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                        <Ico de={courant.icone} size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.titre}</p>
                        <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                          <FolderTree size={11} aria-hidden className="shrink-0" />
                          <span className="truncate">{p.emplacement_menu ?? "Pages"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 text-sm">
                      <p className="truncate">
                        {p.visibilite === "entreprise" ? "Toute l’entreprise" : nomDepartement(p.departement_id)}
                      </p>
                      {p.auteur && (
                        <p className="truncate text-xs text-site-muted">
                          Par {p.auteur.prenom} {p.auteur.nom}
                        </p>
                      )}
                    </div>

                    <div className="text-sm">
                      {p.date_publication ? (
                        <span className="tabular-nums">{date.format(new Date(p.date_publication))}</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-site-line px-2.5 py-1 text-[11px] font-medium text-site-muted">
                          Non publiée
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 md:justify-end">
                      <BoutonIcone
                        libelle={`Modifier ${p.titre}`}
                        disabled={occupe}
                        onClick={() => setFormulaire({ page: p })}
                      >
                        <Pencil size={16} aria-hidden />
                      </BoutonIcone>
                      {p.statut_contenu === "publie" ? (
                        <BoutonIcone
                          libelle={`Archiver ${p.titre}`}
                          disabled={occupe}
                          onClick={() =>
                            action(p, "archiver", `La page « ${p.titre} » a été archivée et retirée du menu.`)
                          }
                        >
                          <Archive size={16} aria-hidden />
                        </BoutonIcone>
                      ) : (
                        <BoutonIcone
                          libelle={p.statut_contenu === "archive" ? `Republier ${p.titre}` : `Publier ${p.titre}`}
                          disabled={occupe}
                          onClick={() => action(p, "publier", `La page « ${p.titre} » est publiée.`)}
                        >
                          <Send size={16} aria-hidden />
                        </BoutonIcone>
                      )}
                      <BoutonIcone
                        libelle={`Supprimer ${p.titre}`}
                        danger
                        disabled={occupe}
                        onClick={() => setASupprimer(p)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </BoutonIcone>
                    </div>
                  </li>
                );
              })}
            </ul>

            {res.last_page > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-3 border-t border-site-line px-5 py-3"
              >
                <p className="text-xs text-site-muted">
                  Page {res.current_page} sur {res.last_page} · {nombre.format(res.total)} page
                  {res.total > 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    disabled={res.current_page <= 1}
                    aria-label="Page précédente"
                    className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.min(res.last_page, n + 1))}
                    disabled={res.current_page >= res.last_page}
                    aria-label="Page suivante"
                    className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}
      </section>

      {formulaire && (
        <PageFormulaire
          key={formulaire.page?.id ?? "nouvelle"}
          page={formulaire.page}
          departements={departements}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aSupprimer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-suppression-page"
        >
          <button
            type="button"
            aria-label="Annuler"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setASupprimer(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suppression-page" className="font-display text-base font-semibold">
              Supprimer cette page ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              La page « {aSupprimer.titre} » et ses images seront supprimées définitivement. Pour la retirer du menu
              sans la perdre, archivez-la plutôt.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setASupprimer(null)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => supprimer(aSupprimer)}
                className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

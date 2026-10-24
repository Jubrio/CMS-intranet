"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutTemplate, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { formaterDate } from "./annuaire-commun";
import type { PageInterne } from "./page-formulaire";

// Pages internes en lecture seule : liste regroupée par rubrique (emplacement dans le menu),
// lecture dans un panneau avec images. L'API ne renvoie que les pages publiées qui nous sont destinées.

type Pagination<T> = { data: T[]; current_page: number; last_page: number; total: number };
type ImagePage = { id: number; nom_image: string; texte_alternatif: string | null; url: string };
type Detail = PageInterne & { corps: string; images: ImagePage[] };

const SANS_RUBRIQUE = "Autres pages";

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function LecteurPage({ page, onFermer }: { page: { id: number; titre: string }; onFermer: () => void }) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = defilement;
    };
  }, [onFermer]);

  const charger = useCallback((jeton: string) => api<Detail>(`/pages/${page.id}`, { token: jeton }), [page.id]);
  const { donnees: d, chargement, erreur, reessayer } = useDonnees(true, charger);
  const publie = d?.date_publication ? formaterDate(d.date_publication) : null;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-page">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-site-line px-5">
          <h2 id="titre-page" className="truncate font-display text-base font-semibold">
            {d?.titre ?? page.titre}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {erreur ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
              <span>Impossible de charger cette page. Elle a peut-être été retirée.</span>
              <button
                type="button"
                onClick={reessayer}
                className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
              >
                Réessayer
              </button>
            </div>
          ) : chargement || !d ? (
            <div className="space-y-3" aria-hidden>
              <Squelette className="h-4 w-48" />
              <Squelette className="h-3.5 w-full" />
              <Squelette className="h-3.5 w-full" />
              <Squelette className="h-3.5 w-2/3" />
            </div>
          ) : (
            <>
              <p className="text-xs text-site-muted">
                {[
                  d.emplacement_menu,
                  d.auteur ? `Par ${d.auteur.prenom} ${d.auteur.nom}` : null,
                  publie ? `Publiée le ${publie}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{d.corps}</div>
              {d.images.length > 0 && (
                <ul className="space-y-3">
                  {d.images.map((i) => (
                    <li key={i.id} className="overflow-hidden rounded-xl border border-site-line">
                      {/* Adresse signée temporaire : next/image n'est pas adapté */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={i.url}
                        alt={i.texte_alternatif ?? i.nom_image}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PagesConsultation() {
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [ouverte, setOuverte] = useState<{ id: number; titre: string } | null>(null);

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const cleCourante = `${page}|${q}`;
  const charger = useCallback(
    async (jeton: string) => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set("q", q);
      const res = await api<Pagination<PageInterne>>(`/pages?${p.toString()}`, { token: jeton });
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [page, q, cleCourante],
  );
  const liste = useDonnees(true, charger);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;

  // Regroupement par rubrique, dans l'ordre renvoyé par l'API (rubrique puis titre)
  const rubriques = useMemo(() => {
    const m = new Map<string, PageInterne[]>();
    for (const p of res?.data ?? []) {
      const cle = p.emplacement_menu?.trim() || SANS_RUBRIQUE;
      m.set(cle, [...(m.get(cle) ?? []), p]);
    }
    return [...m.entries()];
  }, [res]);

  const fermer = useCallback(() => setOuverte(null), []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Pages internes</h1>
        <p className="mt-1 text-sm text-site-muted">
          Les pages d’information de votre entreprise : présentation, procédures, guides…
        </p>
      </header>

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
          placeholder="Rechercher une page"
          aria-label="Rechercher une page"
          className={cn(CHAMP, "pl-9")}
        />
      </div>

      {liste.erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
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
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <Squelette key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : !res || res.data.length === 0 ? (
        <div className="rounded-2xl border border-site-line bg-site-surface px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
            <LayoutTemplate size={22} aria-hidden />
          </span>
          <p className="mt-4 text-sm font-medium">
            {q ? "Aucune page ne correspond à cette recherche." : "Aucune page publiée pour le moment."}
          </p>
        </div>
      ) : (
        <>
          {rubriques.map(([rubrique, pages]) => (
            <section key={rubrique}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-site-muted">{rubrique}</h2>
              <ul className="space-y-2">
                {pages.map((p) => {
                  const maj = p.date_publication ? formaterDate(p.date_publication) : null;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setOuverte({ id: p.id, titre: p.titre })}
                        className="flex w-full items-center gap-4 rounded-2xl border border-site-line bg-site-surface p-4 text-left shadow-sm transition-colors hover:border-brand-violet/60"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                          <LayoutTemplate size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.titre}</span>
                          <span className="block truncate text-xs text-site-muted">
                            {[p.auteur ? `${p.auteur.prenom} ${p.auteur.nom}` : null, maj ? `Publiée le ${maj}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-site-muted" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {res.last_page > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={res.current_page <= 1}
                aria-label="Page précédente"
                className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span className="text-site-muted">
                Page {res.current_page} sur {res.last_page}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(res.last_page, p + 1))}
                disabled={res.current_page >= res.last_page}
                aria-label="Page suivante"
                className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}

      {ouverte && <LecteurPage key={ouverte.id} page={ouverte} onFermer={fermer} />}
    </div>
  );
}

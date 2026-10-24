"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { formaterDate } from "./annuaire-commun";
import type { CategorieFaq, QuestionFaq } from "./faq-formulaire";

// FAQ en lecture seule : recherche, filtre par catégorie, réponses dépliables.

type Pagination<T> = { data: T[]; current_page: number; last_page: number; total: number };

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

export function FaqConsultation() {
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [categorieChoisie, setCategorieChoisie] = useState("");
  const [page, setPage] = useState(1);
  const [ouvertes, setOuvertes] = useState<Set<number>>(new Set());

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const chargerCategories = useCallback((jeton: string) => api<CategorieFaq[]>("/faq/categories", { token: jeton }), []);
  const cats = useDonnees(true, chargerCategories);
  const categories = useMemo(() => cats.donnees ?? [], [cats.donnees]);
  // Une catégorie qui n'existe plus ne filtre plus
  const categorie = cats.donnees === null || categories.some((c) => c.categorie === categorieChoisie) ? categorieChoisie : "";

  const cleCourante = `${page}|${q}|${categorie}`;
  const chargerListe = useCallback(
    async (jeton: string) => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set("q", q);
      if (categorie) p.set("categorie", categorie);
      const res = await api<Pagination<QuestionFaq>>(`/faq?${p.toString()}`, { token: jeton });
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [page, q, categorie, cleCourante],
  );
  const liste = useDonnees(true, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;
  const filtre = q !== "" || categorie !== "";

  function basculer(id: number) {
    setOuvertes((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">FAQ</h1>
        <p className="mt-1 text-sm text-site-muted">Les réponses aux questions fréquentes de votre entreprise.</p>
      </header>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-site-line p-4">
          <div className="relative min-w-52 max-w-md flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted" />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Rechercher dans les questions et réponses"
              aria-label="Rechercher dans la FAQ"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
          <select
            value={categorie}
            onChange={(e) => {
              setCategorieChoisie(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par catégorie"
            className={cn(CHAMP, "w-auto min-w-44")}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.categorie} value={c.categorie}>
                {c.categorie} ({c.nb_questions})
              </option>
            ))}
          </select>
          {filtre && (
            <button
              type="button"
              onClick={() => {
                setSaisie("");
                setQ("");
                setCategorieChoisie("");
                setPage(1);
              }}
              className="inline-flex h-10 items-center rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger la FAQ.</span>
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
                <Squelette className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-72 max-w-full" />
                  <Squelette className="h-3 w-24" />
                </div>
              </li>
            ))}
          </ul>
        ) : !res || res.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <CircleHelp size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">{filtre ? "Aucune question ne correspond à cette recherche." : "Aucune question pour le moment."}</p>
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-site-line">
              {res.data.map((f) => {
                const ouverte = ouvertes.has(f.id);
                const miseAJour = formaterDate(f.updated_at);
                return (
                  <li key={f.id} className="px-5 py-3 transition-colors hover:bg-site-surface2/50">
                    <button
                      type="button"
                      onClick={() => basculer(f.id)}
                      aria-expanded={ouverte}
                      aria-controls={`reponse-${f.id}`}
                      className="flex w-full items-start gap-3 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-violet/15 text-brand-violet">
                        <ChevronDown size={16} aria-hidden className={cn("transition-transform", ouverte && "rotate-180")} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-semibold", !ouverte && "truncate")}>{f.question}</span>
                        <span className="mt-1 inline-flex max-w-full rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                          <span className="truncate">{f.categorie}</span>
                        </span>
                      </span>
                    </button>

                    {ouverte && (
                      <div id={`reponse-${f.id}`} className="ml-11 mt-2 rounded-xl border border-site-line bg-site-base/40 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{f.reponse}</p>
                        {miseAJour && <p className="mt-2 text-xs text-site-muted">Mise à jour le {miseAJour}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {res.last_page > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-center gap-3 border-t border-site-line px-5 py-3 text-sm">
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
          </div>
        )}
      </section>
    </div>
  );
}

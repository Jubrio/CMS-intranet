"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { initiales } from "@/lib/espace";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import type { ChampDef, FormulaireInterne } from "./formulaire-editeur";

type Reponse = {
  id: number;
  utilisateur: { id: number; nom: string; prenom: string } | null;
  valeurs: Record<string, string | number | string[] | null>;
  created_at: string;
};

type ReponseApi = {
  formulaire: FormulaireInterne;
  reponses: { data: Reponse[]; current_page: number; last_page: number; total: number };
};

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const jourSeul = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Valeur lisible d'une réponse selon le type du champ
export function formaterValeur(champ: ChampDef, v: Reponse["valeurs"][string] | undefined): string {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (champ.type === "date" && typeof v === "string") {
    const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
    return Number.isNaN(d.getTime()) ? v : jourSeul.format(d);
  }
  return String(v);
}

// Une cellule qui commence par = + - @ serait interprétée comme une formule par le tableur
function cellule(texte: string): string {
  const sur = /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte;
  return `"${sur.replace(/"/g, '""')}"`;
}

type Props = { formulaire: FormulaireInterne; onFermer: () => void };

export function FormulaireReponses({ formulaire, onFermer }: Props) {
  const { token, expirer } = useEspace();
  const [page, setPage] = useState(1);
  const [export_, setExport] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = defilement;
    };
  }, [onFermer]);

  const charger = useCallback(
    async (jeton: string) => ({
      page,
      res: await api<ReponseApi>(`/formulaires/${formulaire.id}/reponses?page=${page}`, { token: jeton }),
    }),
    [formulaire.id, page],
  );
  const { donnees, chargement, erreur, reessayer } = useDonnees(true, charger);
  const enChargement = chargement || (donnees !== null && donnees.page !== page);
  const res = donnees?.res ?? null;
  const champs = res?.formulaire.champs ?? [];

  // Export CSV : on parcourt toutes les pages (50 réponses par page)
  async function exporter() {
    setExport(true);
    setErreurExport(null);
    try {
      const toutes: Reponse[] = [];
      let definition: ChampDef[] = [];
      for (let p = 1, derniere = 1; p <= derniere; p++) {
        const r = await api<ReponseApi>(`/formulaires/${formulaire.id}/reponses?page=${p}`, { token });
        definition = r.formulaire.champs ?? [];
        toutes.push(...r.reponses.data);
        derniere = r.reponses.last_page;
      }
      const entetes = ["Personne", "Date", ...definition.map((c) => c.libelle)];
      const lignes = toutes.map((r) => [
        r.utilisateur ? `${r.utilisateur.prenom} ${r.utilisateur.nom}` : "Compte supprimé",
        dateHeure.format(new Date(r.created_at)),
        ...definition.map((c) => formaterValeur(c, r.valeurs[c.nom])),
      ]);
      // Séparateur « ; » et BOM UTF-8 : s'ouvre correctement dans Excel en français
      const contenu = "﻿" + [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `reponses-${
        formulaire.titre_formulaire
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "formulaire"
      }.csv`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return;
      }
      setErreurExport(messageErreur(e));
    } finally {
      setExport(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-reponses">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-site-line px-5">
          <div className="min-w-0">
            <h2 id="titre-reponses" className="font-display text-base font-semibold">
              Réponses
            </h2>
            <p className="truncate text-xs text-site-muted">{formulaire.titre_formulaire}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={exporter}
              disabled={export_ || !res || res.reponses.total === 0}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
            >
              {export_ ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Download size={14} aria-hidden />
              )}
              Exporter en CSV
            </button>
            <button
              type="button"
              onClick={onFermer}
              aria-label="Fermer"
              className="flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {erreurExport && (
            <p
              role="alert"
              className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger"
            >
              {erreurExport}
            </p>
          )}

          {erreur ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
              <span>Impossible de charger les réponses.</span>
              <button
                type="button"
                onClick={reessayer}
                className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
              >
                Réessayer
              </button>
            </div>
          ) : enChargement || !res ? (
            <div aria-hidden className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-site-line/70" />
              ))}
            </div>
          ) : res.reponses.data.length === 0 ? (
            <p className="rounded-xl border border-dashed border-site-line px-4 py-10 text-center text-sm text-site-muted">
              Aucune réponse pour le moment.
            </p>
          ) : (
            <>
              <p className="text-xs text-site-muted tabular-nums">
                {res.reponses.total} réponse{res.reponses.total > 1 ? "s" : ""}
              </p>
              <ul className="space-y-3">
                {res.reponses.data.map((r) => (
                  <li key={r.id} className="rounded-xl border border-site-line bg-site-base/40">
                    <div className="flex items-center gap-3 border-b border-site-line px-4 py-3">
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-[11px] font-bold text-brand-violet"
                      >
                        {r.utilisateur ? initiales(r.utilisateur) : "?"}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          !r.utilisateur && "text-site-muted",
                        )}
                      >
                        {r.utilisateur ? `${r.utilisateur.prenom} ${r.utilisateur.nom}` : "Compte supprimé"}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-site-muted">
                        {dateHeure.format(new Date(r.created_at))}
                      </span>
                    </div>
                    <dl className="divide-y divide-site-line/60">
                      {champs.map((c) => {
                        const texte = formaterValeur(c, r.valeurs[c.nom]);
                        return (
                          <div
                            key={c.nom}
                            className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4"
                          >
                            <dt className="text-xs text-site-muted">{c.libelle}</dt>
                            <dd className={cn("whitespace-pre-wrap break-words text-sm", !texte && "text-site-muted")}>
                              {texte || "—"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </li>
                ))}
              </ul>

              {res.reponses.last_page > 1 && (
                <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
                  <p className="text-xs text-site-muted">
                    Page {res.reponses.current_page} sur {res.reponses.last_page}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((n) => Math.max(1, n - 1))}
                      disabled={res.reponses.current_page <= 1}
                      aria-label="Page précédente"
                      className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((n) => Math.min(res.reponses.last_page, n + 1))}
                      disabled={res.reponses.current_page >= res.reponses.last_page}
                      aria-label="Page suivante"
                      className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { initiales } from "@/lib/espace";
import { useDonnees } from "./use-donnees";

type Suivi = {
  note: { id: number; titre: string; numero_note: string | null };
  nb_destinataires: number;
  nb_lectures: number;
  lecteurs: {
    data: { utilisateur: { id: number; nom: string; prenom: string } | null; date_lecture: string }[];
    current_page: number;
    last_page: number;
    total: number;
  };
};

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Qui a confirmé avoir lu la note de service (RG24)
export function SuiviLectures({ noteId, titre, onFermer }: { noteId: number; titre: string; onFermer: () => void }) {
  const [page, setPage] = useState(1);

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
      suivi: await api<Suivi>(`/contenus/note_service/${noteId}/lectures?page=${page}`, { token: jeton }),
    }),
    [noteId, page],
  );
  const { donnees, chargement, erreur, reessayer } = useDonnees(true, charger);

  const enChargement = chargement || (donnees !== null && donnees.page !== page);
  const suivi = donnees?.suivi ?? null;
  const part =
    suivi && suivi.nb_destinataires > 0
      ? Math.min(100, Math.round((suivi.nb_lectures / suivi.nb_destinataires) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-suivi-lectures">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-site-line px-5">
          <div className="min-w-0">
            <h2 id="titre-suivi-lectures" className="font-display text-base font-semibold">
              Suivi des lectures
            </h2>
            <p className="truncate text-xs text-site-muted">{titre}</p>
          </div>
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
              <span>Impossible de charger le suivi.</span>
              <button
                type="button"
                onClick={reessayer}
                className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
              >
                Réessayer
              </button>
            </div>
          ) : enChargement || !suivi ? (
            <div aria-hidden className="space-y-3">
              <div className="h-20 animate-pulse rounded-xl bg-site-line/70" />
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-site-line" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-site-line bg-site-base/40 p-4">
                <p className="font-display text-2xl font-bold tabular-nums">
                  {suivi.nb_lectures}
                  <span className="text-base font-normal text-site-muted">
                    {" "}
                    / {suivi.nb_destinataires} destinataire{suivi.nb_destinataires > 1 ? "s" : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-site-muted">ont confirmé la lecture ({part} %)</p>
                <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-site-line/70">
                  <div
                    className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${part}%` }}
                  />
                </div>
              </div>

              {suivi.lecteurs.data.length === 0 ? (
                <p className="rounded-xl border border-dashed border-site-line px-4 py-8 text-center text-sm text-site-muted">
                  Personne n’a encore confirmé la lecture.
                </p>
              ) : (
                <ul className="divide-y divide-site-line rounded-xl border border-site-line">
                  {suivi.lecteurs.data.map((l, i) => (
                    <li key={l.utilisateur?.id ?? `inconnu-${i}`} className="flex items-center gap-3 px-4 py-3">
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-[11px] font-bold text-brand-violet"
                      >
                        {l.utilisateur ? initiales(l.utilisateur) : "?"}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-sm", !l.utilisateur && "text-site-muted")}>
                        {l.utilisateur ? `${l.utilisateur.prenom} ${l.utilisateur.nom}` : "Compte supprimé"}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-site-muted">
                        {dateHeure.format(new Date(l.date_lecture))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {suivi.lecteurs.last_page > 1 && (
                <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
                  <p className="text-xs text-site-muted">
                    Page {suivi.lecteurs.current_page} sur {suivi.lecteurs.last_page}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={suivi.lecteurs.current_page <= 1}
                      aria-label="Page précédente"
                      className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(suivi.lecteurs.last_page, p + 1))}
                      disabled={suivi.lecteurs.current_page >= suivi.lecteurs.last_page}
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

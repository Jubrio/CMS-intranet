"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDonnees } from "./use-donnees";
import { cleJour, lireDate, type Evenement } from "./evenement-formulaire";

// Calendrier et événements en lecture seule : grille du mois ou liste, détail d'un événement.
// L'API renvoie les événements de l'entreprise, de mon département ou que j'ai créés.

type ReponseMois = { debut: string; fin: string; evenements: Evenement[] };
type Vue = "calendrier" | "liste";

const formatMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const formatJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const formatJourCourt = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const formatDateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const debutDuMois = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const jourDe = (e: string) => cleJour(lireDate(e));

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

// Cases de la grille : semaines complètes (lundi → dimanche) qui couvrent le mois
function construireGrille(mois: Date): Date[] {
  const decal = (mois.getDay() === 0 ? 6 : mois.getDay() - 1) % 7;
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const semaines = Math.ceil((decal + nbJours) / 7);
  return Array.from({ length: semaines * 7 }, (_, i) => new Date(mois.getFullYear(), mois.getMonth(), 1 - decal + i));
}

const dansLeJour = (e: Evenement, cle: string) => jourDe(e.date_debut) <= cle && cle <= jourDe(e.date_fin);

// Horaire d'un événement pour un jour donné
function horaire(e: Evenement, cle: string): string {
  const d = lireDate(e.date_debut);
  const f = lireDate(e.date_fin);
  const cleDebut = cleJour(d);
  const cleFin = cleJour(f);
  if (cleDebut === cleFin) return `${formatHeure.format(d)} – ${formatHeure.format(f)}`;
  if (cle === cleDebut) return `À partir de ${formatHeure.format(d)}`;
  if (cle === cleFin) return `Jusqu’à ${formatHeure.format(f)}`;
  return "Toute la journée";
}

function Detail({ evenement: e, onFermer }: { evenement: Evenement; onFermer: () => void }) {
  useEffect(() => {
    const surTouche = (ev: KeyboardEvent) => ev.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  const d = lireDate(e.date_debut);
  const f = lireDate(e.date_fin);
  const memeJour = cleJour(d) === cleJour(f);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="titre-evenement">
      <button type="button" aria-label="Fermer" className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <div className="relative w-full max-w-lg rounded-2xl border border-site-line bg-site-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-site-line px-5 py-4 sm:px-6">
          <h2 id="titre-evenement" className="font-display text-lg font-semibold">
            {e.titre_evenement}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5 text-sm sm:px-6">
          <p className="flex items-start gap-3">
            <CalendarClock size={16} aria-hidden className="mt-0.5 shrink-0 text-site-muted" />
            <span>
              {memeJour ? (
                <>
                  {majuscule(formatDateLongue.format(d))}
                  <span className="block text-site-muted">
                    {formatHeure.format(d)} – {formatHeure.format(f)}
                  </span>
                </>
              ) : (
                <>
                  Du {formatDateLongue.format(d)} à {formatHeure.format(d)}
                  <span className="block">
                    au {formatDateLongue.format(f)} à {formatHeure.format(f)}
                  </span>
                </>
              )}
            </span>
          </p>
          {e.lieu && (
            <p className="flex items-start gap-3">
              <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-site-muted" />
              <span>{e.lieu}</span>
            </p>
          )}
          <p className="flex items-start gap-3">
            <Users size={16} aria-hidden className="mt-0.5 shrink-0 text-site-muted" />
            <span>
              {e.visibilite === "entreprise" ? "Toute l’entreprise" : "Mon département"}
              {e.auteur && <span className="block text-site-muted">Organisé par {e.auteur.prenom} {e.auteur.nom}</span>}
            </span>
          </p>
          {e.description_evenement && <div className="whitespace-pre-wrap break-words rounded-xl border border-site-line bg-site-base/40 px-4 py-3 leading-relaxed">{e.description_evenement}</div>}
        </div>
      </div>
    </div>
  );
}

function LigneEvenement({ e, cle, onOuvrir }: { e: Evenement; cle: string; onOuvrir: (e: Evenement) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOuvrir(e)}
      className="flex w-full items-center gap-4 rounded-xl border border-site-line bg-site-base/40 px-4 py-3 text-left transition-colors hover:border-brand-violet/60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-violet/15 text-brand-violet">
        <CalendarDays size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{e.titre_evenement}</span>
        <span className="block truncate text-xs text-site-muted">
          {horaire(e, cle)}
          {e.lieu && ` · ${e.lieu}`}
        </span>
      </span>
    </button>
  );
}

export function CalendrierConsultation() {
  const [mois, setMois] = useState(() => debutDuMois(new Date()));
  const [vue, setVue] = useState<Vue>("calendrier");
  const [jourChoisi, setJourChoisi] = useState<string | null>(() => cleJour(new Date()));
  const [ouvert, setOuvert] = useState<Evenement | null>(null);

  const grille = useMemo(() => construireGrille(mois), [mois]);
  const premierJour = cleJour(grille[0]);
  const dernierJour = cleJour(grille[grille.length - 1]);
  const cleCourante = `${premierJour}|${dernierJour}`;

  const charger = useCallback(
    async (jeton: string) => {
      const res = await api<ReponseMois>(`/evenements?debut=${premierJour}&fin=${dernierJour}`, { token: jeton });
      return { cle: cleCourante, res };
    },
    [premierJour, dernierJour, cleCourante],
  );
  const liste = useDonnees(true, charger);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const evenements = useMemo(() => (liste.donnees && liste.donnees.cle === cleCourante ? liste.donnees.res.evenements : null), [liste.donnees, cleCourante]);

  const aujourdhui = cleJour(new Date());
  const moisCourant = cleJour(debutDuMois(new Date())) === cleJour(mois);

  function allerMois(delta: number) {
    const m = new Date(mois.getFullYear(), mois.getMonth() + delta, 1);
    setMois(m);
    setJourChoisi(cleJour(debutDuMois(new Date())) === cleJour(m) ? aujourdhui : null);
  }

  function retourAujourdhui() {
    setMois(debutDuMois(new Date()));
    setJourChoisi(aujourdhui);
  }

  const parJour = useMemo(() => {
    const m = new Map<string, Evenement[]>();
    for (const g of grille) {
      const cle = cleJour(g);
      const du = (evenements ?? []).filter((e) => dansLeJour(e, cle));
      if (du.length > 0) m.set(cle, du);
    }
    return m;
  }, [grille, evenements]);

  // Liste : seulement les jours du mois affiché
  const joursDuMois = useMemo(() => grille.filter((g) => g.getMonth() === mois.getMonth()).map(cleJour).filter((c) => parJour.has(c)), [grille, mois, parJour]);
  const nbEvenementsMois = useMemo(() => new Set(joursDuMois.flatMap((c) => (parJour.get(c) ?? []).map((e) => e.id))).size, [joursDuMois, parJour]);

  const fermer = useCallback(() => setOuvert(null), []);
  const duJourChoisi = jourChoisi ? (parJour.get(jourChoisi) ?? []) : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Calendrier</h1>
        <p className="mt-1 text-sm text-site-muted">Les événements de votre entreprise et de votre département.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => allerMois(-1)} aria-label="Mois précédent" className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <h2 className="min-w-44 text-center font-display text-lg font-semibold" aria-live="polite">
            {majuscule(formatMois.format(mois))}
          </h2>
          <button type="button" onClick={() => allerMois(1)} aria-label="Mois suivant" className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60">
            <ChevronRight size={16} aria-hidden />
          </button>
          {!moisCourant && (
            <button type="button" onClick={retourAujourdhui} className="ml-1 inline-flex h-9 items-center rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60">
              Aujourd’hui
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Affichage" className="inline-flex rounded-full border border-site-line bg-site-surface p-1">
          {(
            [
              { code: "calendrier", libelle: "Calendrier", Icone: CalendarDays },
              { code: "liste", libelle: "Liste", Icone: List },
            ] as const
          ).map(({ code, libelle, Icone }) => {
            const actif = vue === code;
            return (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => setVue(code)}
                className={cn("inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors", actif ? "v-gradient-btn" : "text-site-muted hover:text-site-ink")}
              >
                <Icone size={14} aria-hidden />
                {libelle}
              </button>
            );
          })}
        </div>
      </div>

      {liste.erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
          <span>Impossible de charger les événements.</span>
          <button type="button" onClick={liste.reessayer} className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60">
            Réessayer
          </button>
        </div>
      ) : vue === "calendrier" ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-site-line bg-site-surface shadow-sm" aria-busy={enChargement}>
            <div className="grid grid-cols-7 border-b border-site-line bg-site-surface2/40 text-center text-[11px] font-semibold uppercase tracking-wide text-site-muted">
              {JOURS.map((j) => (
                <span key={j} className="py-2">
                  {j}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grille.map((g, i) => {
                const cle = cleJour(g);
                const dansMois = g.getMonth() === mois.getMonth();
                const du = parJour.get(cle) ?? [];
                const choisi = jourChoisi === cle;
                return (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => setJourChoisi(cle)}
                    aria-pressed={choisi}
                    aria-label={`${formatJourLong.format(g)}${du.length ? `, ${du.length} événement${du.length > 1 ? "s" : ""}` : ""}`}
                    className={cn(
                      "flex min-h-14 flex-col items-stretch gap-1 border-b border-site-line p-1.5 text-left transition-colors hover:bg-site-surface2/60 sm:min-h-24",
                      i % 7 !== 6 && "border-r",
                      !dansMois && "bg-site-base/40 text-site-muted",
                      choisi && "bg-brand-violet/10 ring-2 ring-inset ring-brand-violet/60",
                    )}
                  >
                    <span className={cn("flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold tabular-nums", cle === aujourdhui && "v-gradient-btn")}>{g.getDate()}</span>
                    {enChargement ? null : (
                      <>
                        <span className="hidden flex-col gap-0.5 sm:flex">
                          {du.slice(0, 2).map((e) => (
                            <span key={e.id} className="truncate rounded bg-brand-violet/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-violet">
                              {e.titre_evenement}
                            </span>
                          ))}
                          {du.length > 2 && <span className="px-1 text-[10px] text-site-muted">+{du.length - 2} autre{du.length - 2 > 1 ? "s" : ""}</span>}
                        </span>
                        {du.length > 0 && <span className="flex gap-0.5 sm:hidden">{du.slice(0, 3).map((e) => <span key={e.id} className="size-1.5 rounded-full bg-brand-violet" />)}</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {jourChoisi && (
            <section className="rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm">
              <h3 className="mb-3 font-display text-base font-semibold">{majuscule(formatJourLong.format(lireDate(`${jourChoisi} 00:00:00`)))}</h3>
              {enChargement ? (
                <Squelette className="h-14 w-full rounded-xl" />
              ) : duJourChoisi.length === 0 ? (
                <p className="text-sm text-site-muted">Aucun événement ce jour-là.</p>
              ) : (
                <ul className="space-y-2">
                  {duJourChoisi.map((e) => (
                    <li key={e.id}>
                      <LigneEvenement e={e} cle={jourChoisi} onOuvrir={setOuvert} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      ) : enChargement ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <Squelette key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : joursDuMois.length === 0 ? (
        <div className="rounded-2xl border border-site-line bg-site-surface px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
            <CalendarDays size={22} aria-hidden />
          </span>
          <p className="mt-4 text-sm font-medium">Aucun événement ce mois-ci.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-site-muted">
            {nbEvenementsMois} événement{nbEvenementsMois > 1 ? "s" : ""} ce mois-ci
          </p>
          {joursDuMois.map((cle) => {
            const d = lireDate(`${cle} 00:00:00`);
            return (
              <section key={cle} className="rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-3 font-display text-base font-semibold">
                  <span className="flex size-10 flex-col items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                    <span className="text-[9px] font-semibold uppercase leading-none">{formatJourCourt.format(d).replace(".", "")}</span>
                    <span className="text-base font-bold leading-tight tabular-nums">{d.getDate()}</span>
                  </span>
                  {majuscule(formatJourLong.format(d))}
                </h3>
                <ul className="space-y-2">
                  {(parJour.get(cle) ?? []).map((e) => (
                    <li key={e.id}>
                      <LigneEvenement e={e} cle={cle} onOuvrir={setOuvert} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {ouvert && <Detail evenement={ouvert} onFermer={fermer} />}
    </div>
  );
}

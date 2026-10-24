"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Palette tirée des variables du thème visiteur : elle suit le mode clair/sombre.
export const COULEURS_SERIE = [
  "var(--brand-violet)",
  "var(--brand-blue)",
  "var(--brand-cyan)",
  "color-mix(in oklab, var(--brand-violet) 55%, transparent)",
  "color-mix(in oklab, var(--brand-blue) 55%, transparent)",
  "color-mix(in oklab, var(--brand-cyan) 55%, transparent)",
];

// ---- Anneau ------------------------------------------------------------------

type Segment = { label: string; valeur: number; couleur: string };

export function Anneau({
  segments,
  centreValeur,
  centreLibelle,
  description,
}: {
  segments: Segment[];
  centreValeur: string;
  centreLibelle: string;
  description: string;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const visibles = segments.filter((s) => s.valeur > 0);
  const total = visibles.reduce((s, x) => s + x.valeur, 0);
  const rayon = 72;
  const epaisseur = 16;
  const circ = 2 * Math.PI * rayon;
  const ecart = visibles.length > 1 ? 5 : 0;
  let cumul = 0;

  return (
    <div role="img" aria-label={description} className="relative mx-auto size-48 shrink-0">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle
          cx="100"
          cy="100"
          r={rayon}
          fill="none"
          strokeWidth={epaisseur}
          style={{ stroke: "var(--site-line)" }}
        />
        {total > 0 &&
          visibles.map((s, i) => {
            const longueur = (s.valeur / total) * circ;
            const debut = cumul;
            cumul += longueur;
            return (
              <circle
                key={s.label}
                cx="100"
                cy="100"
                r={rayon}
                fill="none"
                strokeWidth={actif === i ? epaisseur + 5 : epaisseur}
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(longueur - ecart, 0.01)} ${circ}`}
                strokeDashoffset={-(debut + ecart / 2)}
                style={{ stroke: s.couleur, transition: "stroke-width .2s ease" }}
                className="cursor-pointer"
                onMouseEnter={() => setActif(i)}
                onMouseLeave={() => setActif(null)}
              >
                <title>{`${s.label} : ${s.valeur}`}</title>
              </circle>
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-4xl font-bold tabular-nums leading-none">
          {actif !== null ? visibles[actif].valeur : centreValeur}
        </span>
        <span className="mt-1.5 max-w-[7rem] truncate text-xs text-site-muted">
          {actif !== null ? visibles[actif].label : centreLibelle}
        </span>
      </div>
    </div>
  );
}

// ---- Courbe en aire (série temporelle) ----------------------------------------

type Point = { label: string; valeur: number; infobulle?: string };

// `unite` et `prefixeDate` ne servent qu'à l'infobulle ; sans eux, elle parle de publications par semaine.
export function CourbeAire({
  donnees,
  description,
  unite = { un: "publication", plusieurs: "publications" },
  prefixeDate = "Semaine du",
}: {
  donnees: Point[];
  description: string;
  unite?: { un: string; plusieurs: string };
  prefixeDate?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [survol, setSurvol] = useState<number | null>(null);
  const n = donnees.length;
  const maxBrut = Math.max(1, ...donnees.map((d) => d.valeur));
  const pas = Math.max(1, Math.ceil(maxBrut / 4));
  const haut = pas * 4;
  const graduations = [4, 3, 2, 1, 0].map((k) => k * pas);

  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => 100 - (v / haut) * 100;

  const ligne = donnees.reduce((d, p, i) => {
    if (i === 0) return `M ${x(0)} ${y(p.valeur)}`;
    const milieu = (x(i - 1) + x(i)) / 2;
    return `${d} C ${milieu} ${y(donnees[i - 1].valeur)}, ${milieu} ${y(p.valeur)}, ${x(i)} ${y(p.valeur)}`;
  }, "");
  const aire = `${ligne} L ${x(n - 1)} 100 L ${x(0)} 100 Z`;
  const actif = survol ?? n - 1;

  return (
    <div role="img" aria-label={description}>
      <div className="flex gap-3">
        <div className="flex h-72 w-7 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-site-muted">
          {graduations.map((g) => (
            <span key={g} className="-my-1.5 leading-none">
              {g}
            </span>
          ))}
        </div>

        <div className="relative h-72 flex-1">
          {/* repères horizontaux */}
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {graduations.map((g, i) => (
              <span
                key={g}
                className={cn(
                  "block border-t",
                  i === graduations.length - 1 ? "border-site-line" : "border-dashed border-site-line/70",
                )}
              />
            ))}
          </div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id={`a-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--brand-violet)", stopOpacity: 0.38 }} />
                <stop offset="100%" style={{ stopColor: "var(--brand-blue)", stopOpacity: 0 }} />
              </linearGradient>
              <linearGradient id={`l-${id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: "var(--brand-violet)" }} />
                <stop offset="100%" style={{ stopColor: "var(--brand-blue)" }} />
              </linearGradient>
            </defs>
            <path d={aire} fill={`url(#a-${id})`} />
            <path
              d={ligne}
              fill="none"
              stroke={`url(#l-${id})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* guide vertical + point actif */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-brand-violet/30"
            style={{ left: `${x(actif)}%`, opacity: survol === null ? 0 : 1 }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-site-surface bg-brand-violet ring-4 ring-brand-violet/25 transition-all duration-150"
            style={{ left: `${x(actif)}%`, bottom: `${100 - y(donnees[actif].valeur)}%` }}
          />

          {survol !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-site-line bg-site-surface2 px-3 py-1.5 text-xs shadow-lg"
              style={{
                left: `${Math.min(86, Math.max(14, x(survol)))}%`,
                top: `calc(${y(donnees[survol].valeur)}% - 14px)`,
              }}
            >
              <span className="font-display font-semibold tabular-nums">{donnees[survol].valeur}</span>{" "}
              <span className="text-site-muted">{donnees[survol].valeur > 1 ? unite.plusieurs : unite.un}</span>
              <span className="block text-[11px] text-site-muted">
                {prefixeDate} {donnees[survol].label}
              </span>
            </div>
          )}

          {/* zones de survol, alignées sur les étiquettes */}
          <div className="absolute inset-0 flex">
            {donnees.map((d, i) => (
              <button
                key={d.label}
                type="button"
                tabIndex={-1}
                aria-label={d.infobulle ?? `${d.label} : ${d.valeur}`}
                className="h-full flex-1 cursor-crosshair"
                onMouseEnter={() => setSurvol(i)}
                onMouseLeave={() => setSurvol(null)}
                onFocus={() => setSurvol(i)}
                onBlur={() => setSurvol(null)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex gap-3">
        <span aria-hidden className="w-7 shrink-0" />
        <div className="flex flex-1">
          {donnees.map((d, i) => (
            <span
              key={d.label}
              className={cn(
                "flex-1 truncate text-center text-[11px] text-site-muted transition-colors",
                i === actif && "font-semibold text-site-ink",
                i % 2 === 0 && "max-sm:invisible",
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Liste de barres horizontales ----------------------------------------------

type Ligne = { id: string | number; label: string; valeur: number; sousTitre?: string };

export function ListeBarres({ lignes, formatValeur }: { lignes: Ligne[]; formatValeur: (n: number) => string }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  const total = lignes.reduce((s, l) => s + l.valeur, 0);

  return (
    <ul className="space-y-4">
      {lignes.map((l, i) => (
        <li key={l.id}>
          <div className="flex items-baseline gap-3 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-violet/12 text-[11px] font-semibold tabular-nums text-brand-violet">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{l.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatValeur(l.valeur)}</span>
            {total > 0 && (
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-site-muted">
                {Math.round((l.valeur / total) * 100)} %
              </span>
            )}
          </div>
          <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-site-line/70">
            <div
              className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max((l.valeur / max) * 100, l.valeur > 0 ? 3 : 0)}%` }}
            />
          </div>
          {l.sousTitre && <p className="mt-1.5 truncate pl-8 text-xs text-site-muted">{l.sousTitre}</p>}
        </li>
      ))}
    </ul>
  );
}

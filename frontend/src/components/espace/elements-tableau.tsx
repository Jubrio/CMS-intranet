"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const nombre = new Intl.NumberFormat("fr-FR");
export const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
export const pluriel = (n: number, singulier: string, plur: string) => (n > 1 ? plur : singulier);
export const pourcent = (partie: number, total: number) => (total > 0 ? Math.round((partie / total) * 100) : 0);

export const BOUTON_PETIT =
  "inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60";

export type Accent = "violet" | "blue" | "cyan";

const ACCENTS: Record<Accent, { tuile: string; halo: string }> = {
  violet: { tuile: "bg-brand-violet/15 text-brand-violet", halo: "bg-brand-violet/20" },
  blue: { tuile: "bg-brand-blue/15 text-brand-blue", halo: "bg-brand-blue/20" },
  cyan: { tuile: "bg-brand-cyan/15 text-brand-cyan", halo: "bg-brand-cyan/20" },
};

export function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

export function Carte({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm sm:p-6", className)}>
      {children}
    </section>
  );
}

export function EnteteCarte({
  icone: Icone,
  titre,
  meta,
  action,
}: {
  icone: LucideIcon;
  titre: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Icone size={17} aria-hidden />
      </span>
      <h2 className="font-display text-[15px] font-semibold">{titre}</h2>
      <div className="ml-auto flex items-center gap-2">
        {meta && (
          <span className="shrink-0 rounded-full border border-site-line bg-site-base/50 px-2.5 py-1 text-[11px] text-site-muted">
            {meta}
          </span>
        )}
        {action}
      </div>
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-site-muted">{children}</p>;
}

export function Kpi({
  icone: Icone,
  accent,
  libelle,
  valeur,
  detail,
  progression,
  chargement,
}: {
  icone: LucideIcon;
  accent: Accent;
  libelle: string;
  valeur: string | null;
  detail?: string;
  progression?: number;
  chargement: boolean;
}) {
  const a = ACCENTS[accent];
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm transition-colors hover:border-brand-violet/40 sm:p-6">
      <span
        aria-hidden
        className={cn("pointer-events-none absolute -right-8 -top-12 size-36 rounded-full blur-3xl", a.halo)}
      />
      <span aria-hidden className="v-gradient-btn absolute inset-x-0 top-0 h-px opacity-70" />
      <div className="relative flex items-center gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", a.tuile)}>
          <Icone size={20} aria-hidden />
        </span>
        <h2 className="text-sm font-medium text-site-muted">{libelle}</h2>
      </div>
      <div className="relative mt-5">
        {chargement || valeur === null ? (
          <>
            <Squelette className="h-10 w-24" />
            <Squelette className="mt-3 h-3.5 w-32" />
          </>
        ) : (
          <>
            <p className="font-display text-[2.5rem] font-bold leading-none tabular-nums">{valeur}</p>
            {progression !== undefined && (
              <div aria-hidden className="mt-4 h-1.5 overflow-hidden rounded-full bg-site-line">
                <div
                  className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.min(100, progression)}%` }}
                />
              </div>
            )}
            {detail && (
              <p className={cn("text-xs text-site-muted", progression !== undefined ? "mt-2.5" : "mt-4")}>{detail}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function BarreTaux({
  libelle,
  valeur,
  total,
  sousTitre,
  icone,
  rang,
}: {
  libelle: string;
  valeur: number;
  total: number;
  sousTitre?: string;
  icone?: LucideIcon;
  rang?: number;
}) {
  const part = pourcent(valeur, total);
  const Icone = icone;
  return (
    <li>
      <div className="flex items-center gap-3 text-sm">
        {Icone ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-violet/12 text-brand-violet">
            <Icone size={13} aria-hidden />
          </span>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-violet/12 text-[11px] font-semibold tabular-nums text-brand-violet">
            {rang}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{libelle}</span>
        <span className="shrink-0 font-semibold tabular-nums">{nombre.format(valeur)}</span>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-site-muted">{part} %</span>
      </div>
      <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-site-line/70">
        <div
          className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(part, valeur > 0 ? 3 : 0)}%` }}
        />
      </div>
      {sousTitre && <p className="mt-1.5 truncate pl-9 text-xs text-site-muted">{sousTitre}</p>}
    </li>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Blocks, Building2, KeyRound, Lock, Power, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { estSuperAdmin } from "@/lib/espace";
import { iconeModule } from "@/lib/module-icons";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";

// ---- Formes des réponses de l'API ------------------------------------------

type ModuleCatalogue = {
  code_module: string;
  nom_module: string;
  description_module: string | null;
  module_obligatoire: boolean;
  nb_permissions: number;
  nb_entreprises: number;
};

type Catalogue = { total_entreprises: number; modules: ModuleCatalogue[] };

type ModuleDetail = ModuleCatalogue & {
  permissions: { code_permission: string; libelle_permission: string }[];
  entreprises: { id: number; nom_entreprise: string; slug: string; statut_entreprise: "active" | "suspendue" }[];
};

const nombre = new Intl.NumberFormat("fr-FR");

function Ico({ de, size }: { de: LucideIcon; size: number }) {
  const Composant = de;
  return <Composant size={size} aria-hidden />;
}

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Stat({ icone, libelle, valeur }: { icone: LucideIcon; libelle: string; valeur: number | null }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Ico de={icone} size={20} />
      </span>
      <div>
        <p className="text-xs font-medium text-site-muted">{libelle}</p>
        {valeur === null ? (
          <Squelette className="mt-1.5 h-6 w-12" />
        ) : (
          <p className="font-display text-2xl font-bold leading-tight tabular-nums">{nombre.format(valeur)}</p>
        )}
      </div>
    </div>
  );
}

const pluriel = (n: number, un: string, plusieurs: string) => `${nombre.format(n)} ${n > 1 ? plusieurs : un}`;

// ---- Fiche d'un module (panneau latéral) -----------------------------------------

function Fiche({ code, onFermer }: { code: string; onFermer: () => void }) {
  const charger = useCallback((jeton: string) => api<ModuleDetail>(`/super/modules/${code}`, { token: jeton }), [code]);
  const { donnees: m, erreur, reessayer } = useDonnees(true, charger);

  useEffect(() => {
    const surTouche = (ev: KeyboardEvent) => ev.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-fiche-module">
      <button type="button" aria-label="Fermer la fiche" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-site-line px-5 py-4">
          <h2 id="titre-fiche-module" className="font-display text-base font-semibold">
            Fiche du module
          </h2>
          <button
            type="button"
            aria-label="Fermer la fiche"
            onClick={onFermer}
            className="inline-flex size-9 items-center justify-center rounded-full text-site-muted hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {erreur ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
              <span>Impossible de charger ce module.</span>
              <button
                type="button"
                onClick={reessayer}
                className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
              >
                Réessayer
              </button>
            </div>
          ) : !m ? (
            <div aria-hidden className="space-y-4">
              <div className="flex items-center gap-4">
                <Squelette className="size-14 rounded-xl" />
                <div className="space-y-2">
                  <Squelette className="h-4 w-40" />
                  <Squelette className="h-3 w-24" />
                </div>
              </div>
              <Squelette className="h-24 w-full" />
              <Squelette className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                  <Ico de={iconeModule(m.code_module)} size={26} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{m.nom_module}</p>
                  <p className="truncate font-mono text-xs text-site-muted">{m.code_module}</p>
                  <p
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      m.module_obligatoire ? "bg-site-line text-site-muted" : "bg-brand-violet/15 text-brand-violet",
                    )}
                  >
                    {m.module_obligatoire && <Lock size={10} aria-hidden />}
                    {m.module_obligatoire ? "Obligatoire, toujours actif" : "Optionnel"}
                  </p>
                </div>
              </div>

              {m.description_module && <p className="text-sm text-site-muted">{m.description_module}</p>}

              <section>
                <h3 className="mb-2 font-display text-sm font-semibold">
                  Permissions <span className="font-normal text-site-muted">({m.permissions.length})</span>
                </h3>
                {m.permissions.length === 0 ? (
                  <p className="text-sm text-site-muted">Ce module ne définit aucune permission.</p>
                ) : (
                  <ul className="divide-y divide-site-line rounded-xl border border-site-line">
                    {m.permissions.map((p) => (
                      <li key={p.code_permission} className="px-3 py-2.5">
                        <p className="text-sm font-medium">{p.libelle_permission}</p>
                        <p className="font-mono text-[11px] text-site-muted">{p.code_permission}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 font-display text-sm font-semibold">
                  Entreprises utilisatrices <span className="font-normal text-site-muted">({nombre.format(m.nb_entreprises)})</span>
                </h3>
                {m.entreprises.length === 0 ? (
                  <p className="text-sm text-site-muted">Aucune entreprise n’utilise ce module pour le moment.</p>
                ) : (
                  <>
                    <ul className="divide-y divide-site-line rounded-xl border border-site-line">
                      {m.entreprises.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className={cn("truncate text-sm font-medium", e.statut_entreprise === "suspendue" && "text-site-muted")}>{e.nom_entreprise}</p>
                            <p className="truncate text-xs text-site-muted">{e.slug}</p>
                          </div>
                          {e.statut_entreprise === "suspendue" && (
                            <span className="shrink-0 rounded-full bg-site-danger/15 px-2 py-0.5 text-[10px] font-semibold text-site-danger">Suspendue</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {m.nb_entreprises > m.entreprises.length && (
                      <p className="mt-2 text-xs text-site-muted">Les {m.entreprises.length} premières entreprises sont affichées, par ordre alphabétique.</p>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---- Écran principal ------------------------------------------------------------

function CarteModule({ m, total, onOuvrir }: { m: ModuleCatalogue; total: number; onOuvrir: () => void }) {
  const part = total > 0 ? Math.round((m.nb_entreprises / total) * 100) : 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Ouvrir la fiche du module ${m.nom_module}`}
        className="flex h-full w-full items-start gap-3 rounded-2xl border border-site-line bg-site-surface p-4 text-left shadow-sm transition-colors hover:border-brand-violet/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
          <Ico de={iconeModule(m.code_module)} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{m.nom_module}</p>
            {m.module_obligatoire && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-site-line px-2 py-0.5 text-[10px] font-semibold text-site-muted">
                <Lock size={10} aria-hidden />
                Obligatoire
              </span>
            )}
          </div>
          <p className="truncate font-mono text-[11px] text-site-muted">{m.code_module}</p>
          {m.description_module && <p className="mt-1.5 text-xs text-site-muted">{m.description_module}</p>}

          <div className="mt-3 flex items-center gap-3 text-[11px] text-site-muted">
            <span className="inline-flex items-center gap-1">
              <KeyRound size={12} aria-hidden />
              {pluriel(m.nb_permissions, "permission", "permissions")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Building2 size={12} aria-hidden />
              {pluriel(m.nb_entreprises, "entreprise", "entreprises")}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-site-line"
            role="img"
            aria-label={`Utilisé par ${part} % des entreprises`}
          >
            <div className="v-gradient-btn h-full rounded-full" style={{ width: `${part}%` }} />
          </div>
        </div>
      </button>
    </li>
  );
}

export function ModulesCatalogue() {
  const { profil } = useEspace();
  const autorise = estSuperAdmin(profil);
  const [selection, setSelection] = useState<string | null>(null);

  const charger = useCallback((jeton: string) => api<Catalogue>("/super/modules", { token: jeton }), []);
  const { donnees, erreur, reessayer } = useDonnees(autorise, charger);

  const fermerFiche = useCallback(() => setSelection(null), []);

  if (!autorise) {
    return <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">Cet écran est réservé au super-administrateur.</p>;
  }

  const modules = donnees?.modules ?? null;
  const obligatoires = modules?.filter((m) => m.module_obligatoire) ?? [];
  const optionnels = modules?.filter((m) => !m.module_obligatoire) ?? [];
  const total = donnees?.total_entreprises ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Catalogue de modules</h1>
      </div>

      {erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted shadow-sm">
          <span>Impossible de charger le catalogue.</span>
          <button
            type="button"
            onClick={reessayer}
            className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icone={Blocks} libelle="Modules au catalogue" valeur={modules ? modules.length : null} />
            <Stat icone={Lock} libelle="Modules obligatoires" valeur={modules ? obligatoires.length : null} />
            <Stat icone={Power} libelle="Modules optionnels" valeur={modules ? optionnels.length : null} />
          </div>

          {modules === null ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-site-line bg-site-surface p-4">
                  <Squelette className="size-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Squelette className="h-4 w-32" />
                    <Squelette className="h-3 w-44" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <section>
                <h2 className="mb-3 font-display text-sm font-semibold">Fonctionnalités de base</h2>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {obligatoires.map((m) => (
                    <CarteModule key={m.code_module} m={m} total={total} onOuvrir={() => setSelection(m.code_module)} />
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="mb-3 font-display text-sm font-semibold">Modules optionnels</h2>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {optionnels.map((m) => (
                    <CarteModule key={m.code_module} m={m} total={total} onOuvrir={() => setSelection(m.code_module)} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      {selection !== null && <Fiche key={selection} code={selection} onFermer={fermerFiche} />}
    </div>
  );
}

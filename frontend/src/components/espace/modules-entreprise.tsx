"use client";

import { useCallback, useState } from "react";
import { Blocks, CircleCheck, Lock, Power, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { iconeModule } from "@/lib/module-icons";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";

type ModuleEtat = {
  code_module: string;
  nom_module: string;
  description_module: string;
  module_obligatoire: boolean;
  actif: boolean;
};

// Dépendances imposées par les routes du serveur : « code » ne fonctionne que si ses prérequis sont actifs
const DEPENDANCES: Record<string, string[]> = { evenements: ["calendrier"] };

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
        {valeur === null ? <Squelette className="mt-1.5 h-6 w-12" /> : <p className="font-display text-2xl font-bold leading-tight tabular-nums">{nombre.format(valeur)}</p>}
      </div>
    </div>
  );
}

function Interrupteur({ actif, occupe, libelle, onChange }: { actif: boolean; occupe: boolean; libelle: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={occupe}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40 disabled:opacity-60",
        actif ? "bg-brand-violet" : "bg-site-line",
      )}
    >
      <span className={cn("size-5 rounded-full bg-white shadow transition-transform", actif ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

export function ModulesEntreprise() {
  const { profil, token, expirer, actualiser } = useEspace();
  const autorise = profil.permissions.includes("personnalisation.modules");

  const [version, setVersion] = useState(0);
  const [surcharge, setSurcharge] = useState<Record<string, boolean>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [aDesactiver, setADesactiver] = useState<ModuleEtat | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  const charger = useCallback(
    async (jeton: string) => {
      void version;
      return api<ModuleEtat[]>("/modules", { token: jeton });
    },
    [version],
  );
  const { donnees, erreur, reessayer } = useDonnees(autorise, charger);

  const modules = donnees?.map((m) => ({ ...m, actif: m.module_obligatoire ? true : (surcharge[m.code_module] ?? m.actif) })) ?? null;
  const nomDe = (code: string) => modules?.find((m) => m.code_module === code)?.nom_module ?? code;
  const estActif = (code: string) => modules?.find((m) => m.code_module === code)?.actif ?? false;

  async function changer(m: ModuleEtat, actif: boolean) {
    setADesactiver(null);
    setEnCours(m.code_module);
    setNotice(null);
    try {
      await api<{ code_module: string; actif: boolean }>(`/modules/${m.code_module}`, { method: "PUT", token, body: JSON.stringify({ actif }) });
      setSurcharge((s) => ({ ...s, [m.code_module]: actif }));
      setVersion((v) => v + 1);
      await actualiser(); // le menu latéral suit aussitôt
      const manquants = actif ? (DEPENDANCES[m.code_module] ?? []).filter((c) => !estActif(c)) : [];
      setNotice(
        manquants.length > 0
          ? { type: "erreur", texte: `« ${m.nom_module} » est activé, mais il ne fonctionnera qu'avec le module ${manquants.map(nomDe).join(", ")}. Activez-le aussi.` }
          : { type: "ok", texte: `Le module « ${m.nom_module} » est ${actif ? "activé" : "désactivé"}.` },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCours(null);
    }
  }

  if (!autorise) {
    return <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">Vous n’avez pas accès à la gestion des modules.</p>;
  }

  const obligatoires = modules?.filter((m) => m.module_obligatoire) ?? [];
  const optionnels = modules?.filter((m) => !m.module_obligatoire) ?? [];
  const nbActifs = modules ? modules.filter((m) => m.actif).length : null;
  const nbOptionnelsActifs = modules ? optionnels.filter((m) => m.actif).length : null;

  // Modules actifs qui dépendent de celui qu'on s'apprête à désactiver
  const dependants = aDesactiver ? Object.entries(DEPENDANCES).filter(([code, pre]) => pre.includes(aDesactiver.code_module) && estActif(code)).map(([code]) => nomDe(code)) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Modules</h1>
        <p className="mt-1 text-sm text-site-muted">Choisissez les fonctionnalités disponibles dans l’intranet de votre entreprise.</p>
      </div>

      {notice && (
        <p
          role={notice.type === "erreur" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok" ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan" : "border-site-danger/40 bg-site-danger/10 text-site-danger",
          )}
        >
          {notice.texte}
          <button type="button" aria-label="Masquer le message" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={16} aria-hidden />
          </button>
        </p>
      )}

      {erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted shadow-sm">
          <span>Impossible de charger les modules.</span>
          <button type="button" onClick={reessayer} className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60">
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icone={Blocks} libelle="Modules disponibles" valeur={modules ? modules.length : null} />
            <Stat icone={CircleCheck} libelle="Modules actifs" valeur={nbActifs} />
            <Stat icone={Power} libelle="Optionnels activés" valeur={nbOptionnelsActifs} />
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
                    <li key={m.code_module} className="flex items-start gap-3 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                        <Ico de={iconeModule(m.code_module)} size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.nom_module}</p>
                        <p className="mt-0.5 text-xs text-site-muted">{m.description_module}</p>
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-site-line px-2 py-0.5 text-[10px] font-semibold text-site-muted">
                          <Lock size={10} aria-hidden />
                          Obligatoire, toujours actif
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="mb-3 font-display text-sm font-semibold">Modules optionnels</h2>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {optionnels.map((m) => {
                    const pre = DEPENDANCES[m.code_module] ?? [];
                    const manquants = pre.filter((c) => !estActif(c));
                    return (
                      <li
                        key={m.code_module}
                        className={cn("flex items-start gap-3 rounded-2xl border bg-site-surface p-4 shadow-sm transition-colors", m.actif ? "border-brand-violet/40" : "border-site-line")}
                      >
                        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", m.actif ? "bg-brand-violet/15 text-brand-violet" : "bg-site-line text-site-muted")}>
                          <Ico de={iconeModule(m.code_module)} size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{m.nom_module}</p>
                          <p className="mt-0.5 text-xs text-site-muted">{m.description_module}</p>
                          {pre.length > 0 && (
                            <p className={cn("mt-2 flex items-start gap-1.5 text-[11px]", m.actif && manquants.length > 0 ? "text-site-danger" : "text-site-muted")}>
                              {m.actif && manquants.length > 0 && <TriangleAlert size={12} aria-hidden className="mt-0.5 shrink-0" />}
                              <span>
                                Nécessite aussi le module {pre.map(nomDe).join(", ")}
                                {m.actif && manquants.length > 0 ? " (inactif)" : ""}.
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Interrupteur
                            actif={m.actif}
                            occupe={enCours === m.code_module}
                            libelle={`${m.actif ? "Désactiver" : "Activer"} le module ${m.nom_module}`}
                            onChange={() => (m.actif ? setADesactiver(m) : changer(m, true))}
                          />
                          <span className={cn("text-[10px] font-semibold", m.actif ? "text-brand-violet" : "text-site-muted")}>{m.actif ? "Actif" : "Inactif"}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      {aDesactiver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titre-desactivation">
          <button type="button" aria-label="Annuler" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setADesactiver(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-desactivation" className="font-display text-base font-semibold">
              Désactiver le module « {aDesactiver.nom_module} » ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Il disparaîtra du menu de tous les utilisateurs et ne sera plus accessible. Les données ne sont pas supprimées : elles reviennent si vous réactivez le module.
            </p>
            {dependants.length > 0 && <p className="mt-2 text-sm text-site-danger">Le module {dependants.join(", ")} cessera aussi de fonctionner.</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" autoFocus onClick={() => setADesactiver(null)} className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60">
                Annuler
              </button>
              <button type="button" onClick={() => changer(aDesactiver, false)} className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

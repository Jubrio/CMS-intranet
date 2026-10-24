"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Eye, KeyRound, Lock, Pencil, Plus, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { RoleFormulaire, type PermissionCatalogue, type Role } from "./role-formulaire";

const nombre = new Intl.NumberFormat("fr-FR");
const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Stat({
  icone: Icone,
  libelle,
  valeur,
  chargement,
}: {
  icone: typeof Users;
  libelle: string;
  valeur: number | null;
  chargement: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Icone size={20} aria-hidden />
      </span>
      <div>
        <p className="text-xs font-medium text-site-muted">{libelle}</p>
        {chargement || valeur === null ? (
          <Squelette className="mt-1.5 h-6 w-12" />
        ) : (
          <p className="font-display text-2xl font-bold leading-tight tabular-nums">{nombre.format(valeur)}</p>
        )}
      </div>
    </div>
  );
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

const COLONNES = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_5.5rem]";

type Donnees = { roles: Role[]; catalogue: PermissionCatalogue[] };

export function Roles() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("roles.gerer");

  const [recherche, setRecherche] = useState("");
  const [version, setVersion] = useState(0);
  const [formulaire, setFormulaire] = useState<{ role: Role | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<Role | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const charger = useCallback(
    async (jeton: string): Promise<Donnees> => {
      void version;
      const [roles, catalogue] = await Promise.all([
        api<Role[]>("/roles", { token: jeton }),
        api<PermissionCatalogue[]>("/permissions", { token: jeton }),
      ]);
      return { roles, catalogue };
    },
    [version],
  );
  const { donnees, chargement, erreur, reessayer } = useDonnees(autorise, charger);

  const roles = donnees?.roles ?? null;
  const catalogue = useMemo(() => donnees?.catalogue ?? [], [donnees]);
  const totalPermissions = Math.max(1, catalogue.length);

  const visibles = useMemo(() => {
    if (!roles) return [];
    const terme = normaliser(recherche.trim());
    return terme ? roles.filter((r) => normaliser(r.nom_role).includes(terme)) : roles;
  }, [roles, recherche]);

  const personnalises = roles?.filter((r) => !r.role_par_defaut).length ?? null;
  const comptes = roles?.reduce((s, r) => s + r.nb_utilisateurs, 0) ?? null;

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function apresEnregistrement(texte: string) {
    setFormulaire(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  }

  async function supprimer(r: Role) {
    setASupprimer(null);
    setEnCoursId(r.id);
    try {
      await api<{ message: string }>(`/roles/${r.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: `Le rôle « ${r.nom_role} » a été supprimé.` });
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
        Vous n’avez pas accès à la gestion des rôles et des permissions.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Rôles et permissions</h1>
          <p className="mt-1 text-sm text-site-muted">
            Définissez ce que chaque rôle peut consulter et gérer dans l’intranet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ role: null })}
          disabled={chargement || erreur}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
        >
          <Plus size={16} aria-hidden />
          Nouveau rôle
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
        <Stat icone={ShieldCheck} libelle="Rôles" valeur={roles?.length ?? null} chargement={chargement} />
        <Stat icone={KeyRound} libelle="Rôles personnalisés" valeur={personnalises} chargement={chargement} />
        <Stat icone={Users} libelle="Comptes rattachés" valeur={comptes} chargement={chargement} />
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
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un rôle"
              aria-label="Rechercher un rôle"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
        </div>

        {erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger les rôles.</span>
            <button
              type="button"
              onClick={reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : chargement ? (
          <ul className="divide-y divide-site-line" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Squelette className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-40" />
                  <Squelette className="h-3 w-64" />
                </div>
              </li>
            ))}
          </ul>
        ) : visibles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <ShieldCheck size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">
              {recherche ? "Aucun rôle ne correspond à cette recherche." : "Aucun rôle pour le moment."}
            </p>
            {!recherche && (
              <p className="mt-1 text-xs text-site-muted">Créez un rôle pour regrouper des permissions.</p>
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
              <span>Rôle</span>
              <span>Permissions</span>
              <span>Comptes</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-site-line">
              {visibles.map((r) => {
                const supprimable = !r.role_par_defaut && r.nb_utilisateurs === 0;
                const raison = r.role_par_defaut
                  ? "Impossible : un rôle par défaut ne peut pas être supprimé"
                  : r.nb_utilisateurs > 0
                    ? "Impossible : ce rôle est attribué à des comptes"
                    : `Supprimer ${r.nom_role}`;
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-site-surface2/50",
                      COLONNES,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          r.role_par_defaut
                            ? "bg-brand-blue/15 text-brand-blue"
                            : "bg-brand-violet/15 text-brand-violet",
                        )}
                      >
                        {r.role_par_defaut ? <Lock size={18} aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.nom_role}</p>
                        <p className="truncate text-xs text-site-muted">
                          {r.role_par_defaut ? "Rôle par défaut, non modifiable" : "Rôle personnalisé"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-site-line/70">
                        <div
                          className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${r.nb_permissions > 0 ? Math.max((r.nb_permissions / totalPermissions) * 100, 4) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {r.nb_permissions}
                        <span className="text-xs font-normal text-site-muted"> / {catalogue.length}</span>
                        <span className="sr-only"> permissions</span>
                      </span>
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                        <Users size={14} aria-hidden className="text-site-muted" />
                        {r.nb_utilisateurs}
                        <span className="sr-only"> compte{r.nb_utilisateurs > 1 ? "s" : ""}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 md:justify-end">
                      <BoutonIcone
                        libelle={r.role_par_defaut ? `Voir ${r.nom_role}` : `Modifier ${r.nom_role}`}
                        onClick={() => setFormulaire({ role: r })}
                      >
                        {r.role_par_defaut ? <Eye size={16} aria-hidden /> : <Pencil size={16} aria-hidden />}
                      </BoutonIcone>
                      <BoutonIcone
                        libelle={raison}
                        danger
                        disabled={!supprimable || enCoursId === r.id}
                        onClick={() => setASupprimer(r)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </BoutonIcone>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {formulaire && (
        <RoleFormulaire
          role={formulaire.role}
          catalogue={catalogue}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aSupprimer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-suppression-role"
        >
          <button
            type="button"
            aria-label="Annuler"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setASupprimer(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suppression-role" className="font-display text-base font-semibold">
              Supprimer ce rôle ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Le rôle « {aSupprimer.nom_role} » sera supprimé définitivement. Cette action est irréversible.
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

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, UserCheck, UserX, Users, X } from "lucide-react";
import { api, ApiError, messageErreur, urlStockage } from "@/lib/api";
import { initiales } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import {
  CHAMP,
  UtilisateurFormulaire,
  type DepartementOption,
  type RoleOption,
  type Utilisateur,
} from "./utilisateur-formulaire";

type Page<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };
type PageTotal = { total: number };

const nombre = new Intl.NumberFormat("fr-FR");

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Avatar({ u }: { u: Utilisateur }) {
  const [echec, setEchec] = useState<string | null>(null);
  const actif = u.statut_compte === "actif";
  const afficher = u.photo && echec !== u.photo;

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold",
        actif ? "bg-brand-violet/15 text-brand-violet" : "bg-site-line text-site-muted",
      )}
    >
      {afficher ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlStockage(u.photo as string)} alt="" loading="lazy" onError={() => setEchec(u.photo ?? null)} className={cn("size-full object-cover", !actif && "opacity-60 grayscale")} />
      ) : (
        initiales(u)
      )}
    </span>
  );
}

function PastilleStatut({ actif }: { actif: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        actif ? "bg-brand-cyan/15 text-brand-cyan" : "bg-site-line text-site-muted",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", actif ? "bg-brand-cyan" : "bg-site-muted")} />
      {actif ? "Actif" : "Inactif"}
    </span>
  );
}

function Stat({ icone: Icone, libelle, valeur, chargement }: { icone: typeof Users; libelle: string; valeur: number | null; chargement: boolean }) {
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

function BoutonIcone({ libelle, onClick, disabled, danger, children }: { libelle: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
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

export function Utilisateurs() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("utilisateurs.gerer");

  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departementId, setDepartementId] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);

  const [formulaire, setFormulaire] = useState<{ utilisateur: Utilisateur | null } | null>(null);
  const [aDesactiver, setADesactiver] = useState<Utilisateur | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const requete = useMemo(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (q) p.set("q", q);
    if (statut) p.set("statut", statut);
    if (roleId) p.set("role_id", roleId);
    if (departementId) p.set("departement_id", departementId);
    return p.toString();
  }, [page, q, statut, roleId, departementId]);
  const cleCourante = `${requete}|${version}`;

  const chargerListe = useCallback(
    async (jeton: string) => {
      const res = await api<Page<Utilisateur>>(`/utilisateurs?${requete}`, { token: jeton });
      // Dernière page vidée (ex. compte désactivé sous un filtre) : on recule jusqu'à la dernière page existante
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [requete, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);

  const chargerStats = useCallback(
    async (jeton: string) => {
      void version;
      const [actifs, inactifs] = await Promise.all([
        api<PageTotal>("/utilisateurs?statut=actif", { token: jeton }),
        api<PageTotal>("/utilisateurs?statut=inactif", { token: jeton }),
      ]);
      return { actifs: actifs.total, inactifs: inactifs.total };
    },
    [version],
  );
  const stats = useDonnees(autorise, chargerStats);

  // Rôles attribuables et départements : si l'un échoue (droits), on continue sans
  const chargerOptions = useCallback(async (jeton: string) => {
    const [r, d] = await Promise.allSettled([
      api<RoleOption[]>("/roles/assignables", { token: jeton }),
      api<DepartementOption[]>("/departements", { token: jeton }),
    ]);
    return {
      roles: r.status === "fulfilled" ? r.value : [],
      departements: d.status === "fulfilled" ? d.value : [],
    };
  }, []);
  const options = useDonnees(autorise, chargerOptions);
  const roles = useMemo(() => options.donnees?.roles ?? [], [options.donnees]);
  const departements = useMemo(() => options.donnees?.departements ?? [], [options.donnees]);
  const nomDepartement = useMemo(() => new Map(departements.map((d) => [d.id, d.nom_departement])), [departements]);

  const resultat = liste.donnees?.res ?? null;
  const rafraichit = liste.donnees !== null && liste.donnees.cle !== cleCourante;

  const filtresActifs = Boolean(q || statut || roleId || departementId);

  function reinitialiser() {
    setSaisie("");
    setQ("");
    setStatut("");
    setRoleId("");
    setDepartementId("");
    setPage(1);
  }

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function apresEnregistrement(texte: string) {
    setFormulaire(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  }

  async function changerStatut(u: Utilisateur) {
    const actif = u.statut_compte !== "actif";
    setADesactiver(null);
    setEnCoursId(u.id);
    try {
      await api<Utilisateur>(`/utilisateurs/${u.id}/statut`, { method: "PUT", token, body: JSON.stringify({ actif }) });
      setNotice({ type: "ok", texte: actif ? `${u.prenom} ${u.nom} est de nouveau actif.` : `${u.prenom} ${u.nom} a été désactivé.` });
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
        Vous n’avez pas accès à la gestion des utilisateurs.
      </p>
    );
  }

  const total = stats.donnees ? stats.donnees.actifs + stats.donnees.inactifs : null;
  const debut = resultat && resultat.total > 0 ? (resultat.current_page - 1) * resultat.per_page + 1 : 0;
  const fin = resultat ? debut + resultat.data.length - (resultat.data.length > 0 ? 1 : 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Utilisateurs</h1>
          <p className="mt-1 text-sm text-site-muted">Gérez les comptes, les rôles et l’accès à l’intranet.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ utilisateur: null })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Nouvel utilisateur
        </button>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icone={Users} libelle="Comptes au total" valeur={total} chargement={stats.chargement} />
        <Stat icone={UserCheck} libelle="Comptes actifs" valeur={stats.donnees?.actifs ?? null} chargement={stats.chargement} />
        <Stat icone={UserX} libelle="Comptes inactifs" valeur={stats.donnees?.inactifs ?? null} chargement={stats.chargement} />
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-site-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted" />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Rechercher par nom, prénom ou e-mail"
              aria-label="Rechercher un utilisateur"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
            <select
              aria-label="Filtrer par statut"
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value);
                setPage(1);
              }}
              className={cn(CHAMP, "lg:w-36")}
            >
              <option value="">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
            <select
              aria-label="Filtrer par rôle"
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setPage(1);
              }}
              className={cn(CHAMP, "lg:w-40")}
            >
              <option value="">Tous les rôles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom_role}
                </option>
              ))}
            </select>
            {departements.length > 0 && (
              <select
                aria-label="Filtrer par département"
                value={departementId}
                onChange={(e) => {
                  setDepartementId(e.target.value);
                  setPage(1);
                }}
                className={cn(CHAMP, "col-span-2 sm:col-span-1 lg:w-44")}
              >
                <option value="">Tous les départements</option>
                {departements.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom_departement}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger la liste des utilisateurs.</span>
            <button
              type="button"
              onClick={liste.reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : liste.chargement ? (
          <ul className="divide-y divide-site-line" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Squelette className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-40" />
                  <Squelette className="h-3 w-56" />
                </div>
              </li>
            ))}
          </ul>
        ) : resultat && resultat.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <Users size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">{filtresActifs ? "Aucun utilisateur ne correspond à ces critères." : "Aucun utilisateur pour le moment."}</p>
            {filtresActifs && (
              <button
                type="button"
                onClick={reinitialiser}
                className="mt-4 inline-flex items-center rounded-full border border-site-line px-4 py-1.5 text-xs font-semibold transition-colors hover:border-brand-violet/60"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          resultat && (
            <div className={cn("transition-opacity", rafraichit && "opacity-60")} aria-busy={rafraichit}>
              <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_7rem_6rem] gap-4 border-b border-site-line px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-site-muted md:grid">
                <span>Utilisateur</span>
                <span>Poste et département</span>
                <span>Rôle</span>
                <span>Statut</span>
                <span className="text-right">Actions</span>
              </div>
              <ul className="divide-y divide-site-line">
                {resultat.data.map((u) => {
                  const actif = u.statut_compte === "actif";
                  const soi = u.id === profil.id;
                  const dep = u.departement_id ? nomDepartement.get(u.departement_id) : null;
                  return (
                    <li
                      key={u.id}
                      className="grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-site-surface2/50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_7rem_6rem]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar u={u} />
                        <div className="min-w-0">
                          <p className={cn("truncate text-sm font-semibold", !actif && "text-site-muted")}>
                            {u.prenom} {u.nom}
                            {soi && <span className="ml-2 rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">Vous</span>}
                          </p>
                          <p className="truncate text-xs text-site-muted">{u.email}</p>
                        </div>
                      </div>
                      <div className="min-w-0 text-sm">
                        <p className="truncate">{u.poste ?? <span className="text-site-muted">—</span>}</p>
                        <p className="truncate text-xs text-site-muted">{dep ?? (u.departement_id ? `Département n° ${u.departement_id}` : "Aucun département")}</p>
                      </div>
                      <div>
                        <span className="inline-flex max-w-full truncate rounded-full border border-site-line px-2.5 py-1 text-[11px] font-semibold">
                          {u.role ?? "—"}
                        </span>
                      </div>
                      <div>
                        <PastilleStatut actif={actif} />
                      </div>
                      <div className="flex items-center gap-1 md:justify-end">
                        <BoutonIcone libelle={`Modifier ${u.prenom} ${u.nom}`} onClick={() => setFormulaire({ utilisateur: u })}>
                          <Pencil size={16} aria-hidden />
                        </BoutonIcone>
                        {!soi && (
                          <BoutonIcone
                            libelle={actif ? `Désactiver ${u.prenom} ${u.nom}` : `Réactiver ${u.prenom} ${u.nom}`}
                            danger={actif}
                            disabled={enCoursId === u.id}
                            onClick={() => (actif ? setADesactiver(u) : changerStatut(u))}
                          >
                            {actif ? <UserX size={16} aria-hidden /> : <UserCheck size={16} aria-hidden />}
                          </BoutonIcone>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-site-line px-5 py-3 text-xs text-site-muted">
                <span>
                  {debut}–{fin} sur {nombre.format(resultat.total)}
                </span>
                {resultat.last_page > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={resultat.current_page <= 1}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-site-line px-3 font-semibold text-site-ink transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft size={14} aria-hidden />
                      Précédent
                    </button>
                    <span className="tabular-nums">
                      Page {resultat.current_page} / {resultat.last_page}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(resultat.last_page, p + 1))}
                      disabled={resultat.current_page >= resultat.last_page}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-site-line px-3 font-semibold text-site-ink transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Suivant
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </section>

      {formulaire && (
        <UtilisateurFormulaire
          utilisateur={formulaire.utilisateur}
          roles={roles}
          departements={departements}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aDesactiver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titre-confirmation">
          <button type="button" aria-label="Annuler" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setADesactiver(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-confirmation" className="font-display text-base font-semibold">
              Désactiver ce compte ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              {aDesactiver.prenom} {aDesactiver.nom} ne pourra plus se connecter et ses sessions en cours seront fermées. Vous pourrez réactiver le compte à tout moment.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setADesactiver(null)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => changerStatut(aDesactiver)}
                className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

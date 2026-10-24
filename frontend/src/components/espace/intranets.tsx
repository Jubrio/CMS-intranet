"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Ban, Building2, ChevronLeft, ChevronRight, CircleCheck, Lock, Mail, PauseCircle, Search, ShieldAlert, Users, X, type LucideIcon } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { estSuperAdmin } from "@/lib/espace";
import { iconeModule } from "@/lib/module-icons";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";

// ---- Formes des réponses de l'API ------------------------------------------

type StatutEntreprise = "active" | "suspendue";

type Intranet = {
  id: number;
  nom_entreprise: string;
  slug: string;
  email_contact: string | null;
  statut_entreprise: StatutEntreprise;
  created_at: string | null;
  nb_utilisateurs: number;
  nb_utilisateurs_actifs: number;
  nb_modules_actifs: number;
};

type Totaux = { entreprises: number; actives: number; suspendues: number; utilisateurs: number };

type PageIntranets = {
  data: Intranet[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  totaux: Totaux;
};

type IntranetDetail = Intranet & {
  modules: { code_module: string; nom_module: string; module_obligatoire: boolean; actif: boolean }[];
  administrateurs: { id: number; nom: string; prenom: string; email: string; statut_compte: string }[];
};

type Notice = { type: "ok" | "erreur"; texte: string };

const nombre = new Intl.NumberFormat("fr-FR");

const dateCourte = (iso: string | null) => (iso ? format(parseISO(iso), "d MMM yyyy", { locale: fr }) : "—");

const initialesEntreprise = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m.charAt(0))
    .join("")
    .toUpperCase() || "?";

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

function PastilleStatut({ statut }: { statut: StatutEntreprise }) {
  const active = statut === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        active ? "bg-brand-cyan/15 text-brand-cyan" : "bg-site-danger/15 text-site-danger",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-brand-cyan" : "bg-site-danger")} />
      {active ? "Active" : "Suspendue"}
    </span>
  );
}

function Logo({ nom, suspendue, grand }: { nom: string; suspendue: boolean; grand?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-bold",
        grand ? "size-14 text-lg" : "size-10 text-xs",
        suspendue ? "bg-site-line text-site-muted" : "bg-brand-violet/15 text-brand-violet",
      )}
    >
      {initialesEntreprise(nom)}
    </span>
  );
}

function Notification({ notice, onFermer }: { notice: Notice; onFermer: () => void }) {
  return (
    <p
      role={notice.type === "erreur" ? "alert" : "status"}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        notice.type === "ok" ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan" : "border-site-danger/40 bg-site-danger/10 text-site-danger",
      )}
    >
      {notice.texte}
      <button type="button" aria-label="Masquer le message" onClick={onFermer} className="shrink-0 opacity-70 hover:opacity-100">
        <X size={16} aria-hidden />
      </button>
    </p>
  );
}

function Ligne({ icone, libelle, children }: { icone: LucideIcon; libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 text-site-muted">
        <Ico de={icone} size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-site-muted">{libelle}</p>
        <div className="break-words font-medium">{children}</div>
      </div>
    </div>
  );
}

// ---- Fiche d'un intranet (panneau latéral) -----------------------------------

function Fiche({
  id,
  version,
  onFermer,
  onChangement,
}: {
  id: number;
  version: number;
  onFermer: () => void;
  onChangement: (notice: Notice) => void;
}) {
  const { token, expirer } = useEspace();
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const charger = useCallback(
    async (jeton: string) => {
      void version;
      return api<IntranetDetail>(`/super/intranets/${id}`, { token: jeton });
    },
    [id, version],
  );
  const { donnees: e, erreur, reessayer } = useDonnees(true, charger);

  useEffect(() => {
    const surTouche = (ev: KeyboardEvent) => ev.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  async function changerStatut(cible: StatutEntreprise) {
    if (!e) return;
    setConfirmer(false);
    setEnCours(true);
    setErreurAction(null);
    try {
      await api<Intranet>(`/super/intranets/${e.id}/statut`, { method: "PUT", token, body: JSON.stringify({ statut: cible }) });
      onChangement({
        type: "ok",
        texte: cible === "suspendue" ? `L'intranet « ${e.nom_entreprise} » est suspendu.` : `L'intranet « ${e.nom_entreprise} » est de nouveau actif.`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setErreurAction(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  const suspendue = e?.statut_entreprise === "suspendue";
  const modulesActifs = e?.modules.filter((m) => m.actif) ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titre-fiche-intranet">
      <button type="button" aria-label="Fermer la fiche" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-site-line px-5 py-4">
          <h2 id="titre-fiche-intranet" className="font-display text-base font-semibold">
            Fiche de l’intranet
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
              <span>Impossible de charger cet intranet.</span>
              <button
                type="button"
                onClick={reessayer}
                className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
              >
                Réessayer
              </button>
            </div>
          ) : !e ? (
            <div aria-hidden className="space-y-4">
              <div className="flex items-center gap-4">
                <Squelette className="size-14 rounded-xl" />
                <div className="space-y-2">
                  <Squelette className="h-4 w-40" />
                  <Squelette className="h-3 w-24" />
                </div>
              </div>
              <Squelette className="h-16 w-full" />
              <Squelette className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Logo nom={e.nom_entreprise} suspendue={suspendue} grand />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{e.nom_entreprise}</p>
                  <p className="truncate text-xs text-site-muted">{e.slug}</p>
                  <div className="mt-1.5">
                    <PastilleStatut statut={e.statut_entreprise} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-site-line p-3">
                  <p className="font-display text-xl font-bold tabular-nums">{nombre.format(e.nb_utilisateurs)}</p>
                  <p className="text-[11px] text-site-muted">Comptes</p>
                </div>
                <div className="rounded-xl border border-site-line p-3">
                  <p className="font-display text-xl font-bold tabular-nums">{nombre.format(e.nb_utilisateurs_actifs)}</p>
                  <p className="text-[11px] text-site-muted">Comptes actifs</p>
                </div>
                <div className="rounded-xl border border-site-line p-3">
                  <p className="font-display text-xl font-bold tabular-nums">{nombre.format(e.nb_modules_actifs)}</p>
                  <p className="text-[11px] text-site-muted">Modules actifs</p>
                </div>
              </div>

              <div className="space-y-4">
                <Ligne icone={Mail} libelle="E-mail de contact">
                  {e.email_contact ?? <span className="text-site-muted">Non renseigné</span>}
                </Ligne>
                <Ligne icone={Building2} libelle="Créé le">
                  {dateCourte(e.created_at)}
                </Ligne>
              </div>

              <section>
                <h3 className="mb-2 font-display text-sm font-semibold">Administrateurs</h3>
                {e.administrateurs.length === 0 ? (
                  <p className="text-sm text-site-muted">Aucun administrateur.</p>
                ) : (
                  <ul className="divide-y divide-site-line rounded-xl border border-site-line">
                    {e.administrateurs.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className={cn("truncate text-sm font-medium", a.statut_compte !== "actif" && "text-site-muted")}>
                            {a.prenom} {a.nom}
                          </p>
                          <p className="truncate text-xs text-site-muted">{a.email}</p>
                        </div>
                        {a.statut_compte !== "actif" && (
                          <span className="shrink-0 rounded-full bg-site-line px-2 py-0.5 text-[10px] font-semibold text-site-muted">Inactif</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 font-display text-sm font-semibold">
                  Modules actifs <span className="font-normal text-site-muted">({modulesActifs.length} sur {e.modules.length})</span>
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {e.modules.map((m) => (
                    <li
                      key={m.code_module}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                        m.actif ? "border-brand-violet/40 bg-brand-violet/10 text-brand-violet" : "border-site-line text-site-muted line-through opacity-70",
                      )}
                    >
                      <Ico de={m.module_obligatoire ? Lock : iconeModule(m.code_module)} size={12} />
                      {m.nom_module}
                    </li>
                  ))}
                </ul>
              </section>

              {erreurAction && (
                <p role="alert" className="rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger">
                  {erreurAction}
                </p>
              )}
            </>
          )}
        </div>

        {e && (
          <div className="border-t border-site-line px-5 py-4">
            {suspendue ? (
              <button
                type="button"
                disabled={enCours}
                onClick={() => changerStatut("active")}
                className="v-gradient-btn inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
              >
                <CircleCheck size={16} aria-hidden />
                {enCours ? "Réactivation…" : "Réactiver l’intranet"}
              </button>
            ) : (
              <button
                type="button"
                disabled={enCours}
                onClick={() => setConfirmer(true)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-site-danger/50 px-5 text-sm font-semibold text-site-danger transition-colors hover:bg-site-danger/10 disabled:opacity-60"
              >
                <Ban size={16} aria-hidden />
                {enCours ? "Suspension…" : "Suspendre l’intranet"}
              </button>
            )}
          </div>
        )}
      </aside>

      {confirmer && e && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titre-suspension">
          <button type="button" aria-label="Annuler" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmer(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suspension" className="flex items-start gap-2 font-display text-base font-semibold">
              <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-site-danger" />
              Suspendre « {e.nom_entreprise} » ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Les {nombre.format(e.nb_utilisateurs)} comptes de cette entreprise seront déconnectés et ne pourront plus se connecter. Les données ne sont pas
              supprimées : tout revient quand vous réactivez l’intranet.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmer(false)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Annuler
              </button>
              <button type="button" onClick={() => changerStatut("suspendue")} className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Suspendre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Écran principal ------------------------------------------------------------

const COLONNES = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_7rem_6rem_6.5rem_7rem]";

export function Intranets() {
  const { profil } = useEspace();
  const autorise = estSuperAdmin(profil);

  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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
    return p.toString();
  }, [page, q, statut]);
  const cleCourante = `${requete}|${version}`;

  const chargerListe = useCallback(
    async (jeton: string) => {
      const res = await api<PageIntranets>(`/super/intranets?${requete}`, { token: jeton });
      // Dernière page vidée (ex. suspension sous un filtre) : on recule jusqu'à la dernière page existante
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [requete, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);

  const resultat = liste.donnees?.res ?? null;
  const totaux = resultat?.totaux ?? null;
  const rafraichit = liste.donnees !== null && liste.donnees.cle !== cleCourante;
  const filtresActifs = Boolean(q || statut);

  function reinitialiser() {
    setSaisie("");
    setQ("");
    setStatut("");
    setPage(1);
  }

  const fermerFiche = useCallback(() => setSelection(null), []);

  if (!autorise) {
    return <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">Cet écran est réservé au super-administrateur.</p>;
  }

  const debut = resultat && resultat.total > 0 ? (resultat.current_page - 1) * resultat.per_page + 1 : 0;
  const fin = resultat ? debut + resultat.data.length - (resultat.data.length > 0 ? 1 : 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Intranets</h1>
        <p className="mt-1 text-sm text-site-muted">Toutes les entreprises de la plateforme : consultez leur activité et suspendez ou réactivez leur intranet.</p>
      </div>

      {notice && <Notification notice={notice} onFermer={() => setNotice(null)} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icone={Building2} libelle="Entreprises" valeur={totaux?.entreprises ?? null} />
        <Stat icone={CircleCheck} libelle="Intranets actifs" valeur={totaux?.actives ?? null} />
        <Stat icone={PauseCircle} libelle="Intranets suspendus" valeur={totaux?.suspendues ?? null} />
        <Stat icone={Users} libelle="Comptes utilisateurs" valeur={totaux?.utilisateurs ?? null} />
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-site-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted" />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Rechercher par nom, identifiant ou e-mail"
              aria-label="Rechercher un intranet"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
          <select
            aria-label="Filtrer par statut"
            value={statut}
            onChange={(e) => {
              setStatut(e.target.value);
              setPage(1);
            }}
            className={cn(CHAMP, "sm:w-44")}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="suspendue">Suspendus</option>
          </select>
        </div>

        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger la liste des intranets.</span>
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
                <Squelette className="size-10 rounded-xl" />
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
              <Building2 size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">{filtresActifs ? "Aucun intranet ne correspond à ces critères." : "Aucun intranet pour le moment."}</p>
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
              <div className={cn("hidden gap-4 border-b border-site-line px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-site-muted md:grid", COLONNES)}>
                <span>Entreprise</span>
                <span>Contact</span>
                <span>Statut</span>
                <span>Comptes</span>
                <span>Modules</span>
                <span>Créé le</span>
              </div>
              <ul className="divide-y divide-site-line">
                {resultat.data.map((e) => {
                  const suspendue = e.statut_entreprise === "suspendue";
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelection(e.id)}
                        aria-label={`Ouvrir la fiche de ${e.nom_entreprise}`}
                        className={cn(
                          "grid w-full items-center gap-x-4 gap-y-3 px-5 py-4 text-left transition-colors hover:bg-site-surface2/50 focus-visible:bg-site-surface2/50 focus-visible:outline-none",
                          COLONNES,
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Logo nom={e.nom_entreprise} suspendue={suspendue} />
                          <div className="min-w-0">
                            <p className={cn("truncate text-sm font-semibold", suspendue && "text-site-muted")}>{e.nom_entreprise}</p>
                            <p className="truncate text-xs text-site-muted">{e.slug}</p>
                          </div>
                        </div>
                        <p className="min-w-0 truncate text-sm">{e.email_contact ?? <span className="text-site-muted">—</span>}</p>
                        <div>
                          <PastilleStatut statut={e.statut_entreprise} />
                        </div>
                        <p className="text-sm tabular-nums">
                          {nombre.format(e.nb_utilisateurs_actifs)}
                          <span className="text-site-muted"> / {nombre.format(e.nb_utilisateurs)}</span>
                        </p>
                        <p className="text-sm tabular-nums">{nombre.format(e.nb_modules_actifs)}</p>
                        <p className="text-sm text-site-muted">{dateCourte(e.created_at)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-site-line px-5 py-3 text-xs text-site-muted">
                <p>
                  {debut}–{fin} sur {nombre.format(resultat.total)}
                </p>
                {resultat.last_page > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Page précédente"
                      disabled={resultat.current_page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft size={16} aria-hidden />
                    </button>
                    <span className="tabular-nums">
                      Page {resultat.current_page} sur {resultat.last_page}
                    </span>
                    <button
                      type="button"
                      aria-label="Page suivante"
                      disabled={resultat.current_page >= resultat.last_page}
                      onClick={() => setPage((p) => p + 1)}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </section>

      {selection !== null && (
        <Fiche
          key={selection}
          id={selection}
          version={version}
          onFermer={fermerFiche}
          onChangement={(n) => {
            setNotice(n);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

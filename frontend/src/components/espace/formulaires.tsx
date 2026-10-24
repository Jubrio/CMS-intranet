"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type LucideIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Inbox,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import type { DepartementOption } from "./contenu-formulaire";
import { FormulaireEditeur, type FormulaireInterne, type StatutFormulaire } from "./formulaire-editeur";
import { FormulaireReponses } from "./formulaire-reponses";

type Pagination<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

const nombre = new Intl.NumberFormat("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const STATUTS: { code: StatutFormulaire; libelle: string; vide: string; icone: LucideIcon }[] = [
  { code: "publie", libelle: "Publiés", vide: "Aucun formulaire publié pour le moment.", icone: ClipboardList },
  { code: "brouillon", libelle: "Brouillons", vide: "Aucun brouillon en cours.", icone: FileText },
  { code: "cloture", libelle: "Clôturés", vide: "Aucun formulaire clôturé.", icone: Lock },
];

// « 2026-11-12 » → date locale (sans décalage de fuseau)
const lireJour = (s: string) => {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(a, m - 1, j);
};

function Ico({ de, size }: { de: LucideIcon; size: number }) {
  const Composant = de;
  return <Composant size={size} aria-hidden />;
}

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
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

const COLONNES = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)_9.5rem]";

export function Formulaires() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("formulaires.gerer");
  const peutListerDepartements = profil.permissions.includes("utilisateurs.departements");

  const [statut, setStatut] = useState<StatutFormulaire>("publie");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editeur, setEditeur] = useState<{ formulaire: FormulaireInterne | null } | null>(null);
  const [reponses, setReponses] = useState<FormulaireInterne | null>(null);
  const [aSupprimer, setASupprimer] = useState<FormulaireInterne | null>(null);
  const [aCloturer, setACloturer] = useState<FormulaireInterne | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Liste de l'onglet courant
  const cleCourante = `${statut}|${page}|${version}`;
  const chargerListe = useCallback(
    async (jeton: string) => {
      const res = await api<Pagination<FormulaireInterne>>(`/formulaires?statut=${statut}&page=${page}`, {
        token: jeton,
      });
      // Dernière page vidée (ex. dernier formulaire clôturé) : on recule jusqu'à la dernière page existante
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [statut, page, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;

  // Compteurs des trois onglets
  const chargerTotaux = useCallback(
    async (jeton: string) => {
      void version;
      const [publie, brouillon, cloture] = await Promise.all(
        STATUTS.map((s) => api<{ total: number }>(`/formulaires?statut=${s.code}`, { token: jeton })),
      );
      return { publie: publie.total, brouillon: brouillon.total, cloture: cloture.total } as Record<
        StatutFormulaire,
        number
      >;
    },
    [version],
  );
  const totaux = useDonnees(autorise, chargerTotaux);

  // Départements : liste complète si le rôle y a accès ; sinon le département de l'utilisateur
  const chargerDepartements = useCallback(
    async (jeton: string) => api<DepartementOption[]>("/departements", { token: jeton }),
    [],
  );
  const deps = useDonnees(autorise && peutListerDepartements, chargerDepartements);
  const departements = useMemo<DepartementOption[]>(() => {
    if (deps.donnees) return deps.donnees;
    if (profil.departement_id) return [{ id: profil.departement_id, nom_departement: "Mon département" }];
    return [];
  }, [deps.donnees, profil.departement_id]);
  const nomDepartement = (id: number | null) =>
    departements.find((d) => d.id === id)?.nom_departement ?? "Un département";

  const fermerEditeur = useCallback(() => setEditeur(null), []);
  const fermerReponses = useCallback(() => setReponses(null), []);

  function apresEnregistrement(texte: string, echecPublication?: string) {
    setEditeur(null);
    setNotice(
      echecPublication
        ? { type: "erreur", texte: `${texte} La publication a échoué : ${echecPublication}` }
        : { type: "ok", texte },
    );
    setVersion((v) => v + 1);
  }

  async function action(f: FormulaireInterne, chemin: "publier" | "cloturer", succes: string) {
    setACloturer(null);
    setEnCoursId(f.id);
    try {
      await api<FormulaireInterne>(`/formulaires/${f.id}/${chemin}`, { method: "POST", token });
      setNotice({ type: "ok", texte: succes });
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

  async function supprimer(f: FormulaireInterne) {
    setASupprimer(null);
    setEnCoursId(f.id);
    try {
      await api<{ message: string }>(`/formulaires/${f.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: `Le formulaire « ${f.titre_formulaire} » a été supprimé.` });
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
        Vous n’avez pas accès à la gestion des formulaires.
      </p>
    );
  }

  const courant = STATUTS.find((s) => s.code === statut)!;
  const aujourdhui = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Formulaires</h1>
          <p className="mt-1 text-sm text-site-muted">
            Créez des formulaires internes, collectez les réponses et exportez-les.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditeur({ formulaire: null })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Nouveau formulaire
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
        {STATUTS.map(({ code, libelle, icone }) => {
          const actif = statut === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={actif}
              onClick={() => {
                setStatut(code);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-4 rounded-2xl border bg-site-surface p-4 text-left shadow-sm transition-colors",
                actif
                  ? "border-brand-violet ring-1 ring-brand-violet/40"
                  : "border-site-line hover:border-brand-violet/50",
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                <Ico de={icone} size={20} />
              </span>
              <span>
                <span className="block text-xs font-medium text-site-muted">{libelle}</span>
                {totaux.donnees ? (
                  <span className="block font-display text-2xl font-bold leading-tight tabular-nums">
                    {nombre.format(totaux.donnees[code])}
                  </span>
                ) : (
                  <Squelette className="mt-1.5 h-6 w-12" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger les formulaires. Votre rôle doit aussi pouvoir remplir les formulaires.</span>
            <button
              type="button"
              onClick={liste.reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : enChargement ? (
          <ul className="divide-y divide-site-line" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Squelette className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-56" />
                  <Squelette className="h-3 w-40" />
                </div>
              </li>
            ))}
          </ul>
        ) : !res || res.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <Ico de={courant.icone} size={22} />
            </span>
            <p className="mt-4 text-sm font-medium">{courant.vide}</p>
            {statut === "publie" && (
              <p className="mt-1 text-xs text-site-muted">
                Créez un formulaire, puis publiez-le pour recueillir des réponses.
              </p>
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
              <span>Formulaire</span>
              <span>Destinataires</span>
              <span>Réponses</span>
              <span>Date limite</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-site-line">
              {res.data.map((f) => {
                const occupe = enCoursId === f.id;
                const limite = f.date_limite ? lireJour(f.date_limite) : null;
                const expire = limite !== null && limite < aujourdhui && f.statut_formulaire === "publie";
                return (
                  <li
                    key={f.id}
                    className={cn(
                      "grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-site-surface2/50",
                      COLONNES,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                        <Ico de={courant.icone} size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{f.titre_formulaire}</p>
                        <p className="truncate text-xs text-site-muted">
                          {f.auteur ? `Par ${f.auteur.prenom} ${f.auteur.nom}` : "Auteur inconnu"}
                          {f.reponse_unique && " · Réponse unique"}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 truncate text-sm">
                      {f.visibilite === "entreprise" ? "Toute l’entreprise" : nomDepartement(f.departement_id)}
                    </div>

                    <div className="text-sm font-semibold tabular-nums">
                      {f.nb_reponses ?? 0}
                      <span className="sr-only"> réponse{(f.nb_reponses ?? 0) > 1 ? "s" : ""}</span>
                    </div>

                    <div className="text-sm">
                      {limite ? (
                        expire ? (
                          <span className="inline-flex rounded-full bg-site-danger/10 px-2.5 py-1 text-[11px] font-semibold text-site-danger">
                            Expiré le {date.format(limite)}
                          </span>
                        ) : (
                          <span className="tabular-nums">{date.format(limite)}</span>
                        )
                      ) : (
                        <span className="text-site-muted">Aucune</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 md:justify-end">
                      <BoutonIcone
                        libelle={`Voir les réponses à ${f.titre_formulaire}`}
                        disabled={occupe}
                        onClick={() => setReponses(f)}
                      >
                        <Inbox size={16} aria-hidden />
                      </BoutonIcone>
                      <BoutonIcone
                        libelle={
                          f.statut_formulaire === "cloture"
                            ? "Un formulaire clôturé ne peut plus être modifié"
                            : `Modifier ${f.titre_formulaire}`
                        }
                        disabled={occupe || f.statut_formulaire === "cloture"}
                        onClick={() => setEditeur({ formulaire: f })}
                      >
                        <Pencil size={16} aria-hidden />
                      </BoutonIcone>
                      {f.statut_formulaire === "brouillon" && (
                        <BoutonIcone
                          libelle={`Publier ${f.titre_formulaire}`}
                          disabled={occupe}
                          onClick={() => action(f, "publier", `Le formulaire « ${f.titre_formulaire} » est publié.`)}
                        >
                          <Send size={16} aria-hidden />
                        </BoutonIcone>
                      )}
                      {f.statut_formulaire !== "cloture" && f.statut_formulaire !== "brouillon" && (
                        <BoutonIcone
                          libelle={`Clôturer ${f.titre_formulaire}`}
                          disabled={occupe}
                          onClick={() => setACloturer(f)}
                        >
                          <Lock size={16} aria-hidden />
                        </BoutonIcone>
                      )}
                      <BoutonIcone
                        libelle={`Supprimer ${f.titre_formulaire}`}
                        danger
                        disabled={occupe}
                        onClick={() => setASupprimer(f)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </BoutonIcone>
                    </div>
                  </li>
                );
              })}
            </ul>

            {res.last_page > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-3 border-t border-site-line px-5 py-3"
              >
                <p className="text-xs text-site-muted">
                  Page {res.current_page} sur {res.last_page} · {nombre.format(res.total)} formulaire
                  {res.total > 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    disabled={res.current_page <= 1}
                    aria-label="Page précédente"
                    className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.min(res.last_page, n + 1))}
                    disabled={res.current_page >= res.last_page}
                    aria-label="Page suivante"
                    className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}
      </section>

      {editeur && (
        <FormulaireEditeur
          key={editeur.formulaire?.id ?? "nouveau"}
          formulaire={editeur.formulaire}
          departements={departements}
          onFermer={fermerEditeur}
          onEnregistre={apresEnregistrement}
        />
      )}

      {reponses && <FormulaireReponses formulaire={reponses} onFermer={fermerReponses} />}

      {aCloturer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-cloture-formulaire"
        >
          <button
            type="button"
            aria-label="Annuler"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setACloturer(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-cloture-formulaire" className="font-display text-base font-semibold">
              Clôturer ce formulaire ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Le formulaire « {aCloturer.titre_formulaire} » n’acceptera plus de réponses et ne pourra plus être
              modifié. Les réponses déjà reçues sont conservées.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setACloturer(null)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() =>
                  action(aCloturer, "cloturer", `Le formulaire « ${aCloturer.titre_formulaire} » est clôturé.`)
                }
                className="v-gradient-btn h-10 rounded-full px-5 text-sm font-semibold"
              >
                Clôturer
              </button>
            </div>
          </div>
        </div>
      )}

      {aSupprimer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-suppression-formulaire"
        >
          <button
            type="button"
            aria-label="Annuler"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setASupprimer(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suppression-formulaire" className="font-display text-base font-semibold">
              Supprimer ce formulaire ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Le formulaire « {aSupprimer.titre_formulaire} » sera supprimé définitivement
              {(aSupprimer.nb_reponses ?? 0) > 0
                ? `, avec ses ${aSupprimer.nb_reponses} réponse${(aSupprimer.nb_reponses ?? 0) > 1 ? "s" : ""}`
                : ""}
              . Cette action est irréversible.
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

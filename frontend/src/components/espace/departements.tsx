"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, CornerDownRight, Pencil, Plus, Search, Trash2, UserX, Users, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { initiales } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { DepartementFormulaire, type Departement } from "./departement-formulaire";

type Noeud = Departement & { profondeur: number; nbEnfants: number };

const nombre = new Intl.NumberFormat("fr-FR");
const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function aplatir(liste: Departement[]): Noeud[] {
  const ids = new Set(liste.map((d) => d.id));
  const enfants = new Map<number | null, Departement[]>();
  for (const d of liste) {
    const cle = d.departement_parent_id !== null && ids.has(d.departement_parent_id) ? d.departement_parent_id : null;
    enfants.set(cle, [...(enfants.get(cle) ?? []), d]);
  }

  const sortie: Noeud[] = [];
  const vus = new Set<number>();
  const visiter = (parent: number | null, profondeur: number) => {
    for (const d of enfants.get(parent) ?? []) {
      if (vus.has(d.id)) continue;
      vus.add(d.id);
      sortie.push({ ...d, profondeur, nbEnfants: (enfants.get(d.id) ?? []).length });
      visiter(d.id, profondeur + 1);
    }
  };
  visiter(null, 0);
  for (const d of liste) {
    if (!vus.has(d.id)) {
      vus.add(d.id);
      sortie.push({ ...d, profondeur: 0, nbEnfants: (enfants.get(d.id) ?? []).length });
    }
  }
  return sortie;
}

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

const COLONNES = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_5.5rem]";

export function Departements() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("utilisateurs.departements");

  const [recherche, setRecherche] = useState("");
  const [version, setVersion] = useState(0);
  const [formulaire, setFormulaire] = useState<{ departement: Departement | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<Noeud | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const charger = useCallback(
    async (jeton: string) => {
      void version;
      return api<Departement[]>("/departements", { token: jeton });
    },
    [version],
  );
  const { donnees, chargement, erreur, reessayer } = useDonnees(autorise, charger);

  const arbre = useMemo(() => (donnees ? aplatir(donnees) : []), [donnees]);

  const visibles = useMemo(() => {
    const terme = normaliser(recherche.trim());
    if (!terme) return arbre;
    const parId = new Map(arbre.map((d) => [d.id, d]));
    const gardes = new Set<number>();
    for (const d of arbre) {
      if (!normaliser(d.nom_departement).includes(terme)) continue;
      let courant: Noeud | undefined = d;
      while (courant && !gardes.has(courant.id)) {
        gardes.add(courant.id);
        courant = courant.departement_parent_id !== null ? parId.get(courant.departement_parent_id) : undefined;
      }
    }
    return arbre.filter((d) => gardes.has(d.id));
  }, [arbre, recherche]);

  const totalEmployes = donnees?.reduce((s, d) => s + d.nb_employes, 0) ?? null;
  const sansResponsable = donnees?.filter((d) => d.responsable_id === null).length ?? null;
  const maxEmployes = Math.max(1, ...(donnees?.map((d) => d.nb_employes) ?? [0]));

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function apresEnregistrement(texte: string) {
    setFormulaire(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  }

  async function supprimer(d: Noeud) {
    setASupprimer(null);
    setEnCoursId(d.id);
    try {
      await api<{ message: string }>(`/departements/${d.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: `Le département « ${d.nom_departement} » a été supprimé.` });
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
        Vous n’avez pas accès à la gestion des départements.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Départements</h1>
          <p className="mt-1 text-sm text-site-muted">
            Organisez l’entreprise en équipes, désignez leurs responsables.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ departement: null })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Nouveau département
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
        <Stat icone={Building2} libelle="Départements" valeur={donnees?.length ?? null} chargement={chargement} />
        <Stat icone={Users} libelle="Employés rattachés" valeur={totalEmployes} chargement={chargement} />
        <Stat icone={UserX} libelle="Sans responsable" valeur={sansResponsable} chargement={chargement} />
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
              placeholder="Rechercher un département"
              aria-label="Rechercher un département"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
        </div>

        {erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger les départements.</span>
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
            {Array.from({ length: 5 }, (_, i) => (
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
              <Building2 size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">
              {recherche ? "Aucun département ne correspond à cette recherche." : "Aucun département pour le moment."}
            </p>
            {!recherche && (
              <p className="mt-1 text-xs text-site-muted">Créez le premier pour y rattacher vos employés.</p>
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
              <span>Département</span>
              <span>Responsable</span>
              <span>Employés</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-site-line">
              {visibles.map((d) => {
                const supprimable = d.nb_employes === 0 && d.nbEnfants === 0;
                const raison =
                  d.nb_employes > 0
                    ? "Impossible : des employés sont rattachés à ce département"
                    : d.nbEnfants > 0
                      ? "Impossible : ce département a des sous-départements"
                      : `Supprimer ${d.nom_departement}`;
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-site-surface2/50",
                      COLONNES,
                    )}
                  >
                    <div
                      className="flex min-w-0 items-center gap-3"
                      style={{ paddingLeft: `${Math.min(d.profondeur, 4) * 22}px` }}
                    >
                      {d.profondeur > 0 && (
                        <CornerDownRight size={15} aria-hidden className="shrink-0 text-site-muted" />
                      )}
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          d.profondeur === 0
                            ? "bg-brand-violet/15 text-brand-violet"
                            : "bg-brand-blue/15 text-brand-blue",
                        )}
                      >
                        <Building2 size={18} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{d.nom_departement}</p>
                        <p className="truncate text-xs text-site-muted">
                          {d.description_departement ??
                            (d.nbEnfants > 0
                              ? `${d.nbEnfants} sous-département${d.nbEnfants > 1 ? "s" : ""}`
                              : "Sans description")}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      {d.responsable ? (
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-[11px] font-bold text-brand-violet"
                          >
                            {initiales(d.responsable)}
                          </span>
                          <span className="truncate text-sm">
                            {d.responsable.prenom} {d.responsable.nom}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-site-line px-2.5 py-1 text-[11px] font-medium text-site-muted">
                          Non défini
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-site-line/70">
                        <div
                          className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${d.nb_employes > 0 ? Math.max((d.nb_employes / maxEmployes) * 100, 4) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {d.nb_employes}
                        <span className="sr-only"> employé{d.nb_employes > 1 ? "s" : ""}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 md:justify-end">
                      <BoutonIcone
                        libelle={`Modifier ${d.nom_departement}`}
                        onClick={() => setFormulaire({ departement: d })}
                      >
                        <Pencil size={16} aria-hidden />
                      </BoutonIcone>
                      <BoutonIcone
                        libelle={raison}
                        danger
                        disabled={!supprimable || enCoursId === d.id}
                        onClick={() => setASupprimer(d)}
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
        <DepartementFormulaire
          departement={formulaire.departement}
          tous={donnees ?? []}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aSupprimer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-suppression"
        >
          <button
            type="button"
            aria-label="Annuler"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setASupprimer(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suppression" className="font-display text-base font-semibold">
              Supprimer ce département ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Le département « {aSupprimer.nom_departement} » sera supprimé définitivement. Cette action est
              irréversible.
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

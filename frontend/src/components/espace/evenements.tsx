"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type LucideIcon,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import type { DepartementOption } from "./contenu-formulaire";
import { cleJour, EvenementFormulaire, lireDate, type Evenement } from "./evenement-formulaire";

type ReponseMois = { debut: string; fin: string; evenements: Evenement[] };

const nombre = new Intl.NumberFormat("fr-FR");
const formatMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const formatJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const formatJourCourt = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const formatDateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const debutDuMois = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const finDuMois = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

type Occurrence = { evenement: Evenement; horaire: string };
type Jour = { cle: string; date: Date; occurrences: Occurrence[] };

// Un événement sur plusieurs jours apparaît à chaque jour du mois qu'il couvre
function grouperParJour(evenements: Evenement[], debut: Date, fin: Date): Jour[] {
  const jours = new Map<string, Jour>();
  for (const e of evenements) {
    const d = lireDate(e.date_debut);
    const f = lireDate(e.date_fin);
    const premier = new Date(Math.max(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), debut.getTime()));
    const dernier = new Date(Math.min(new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime(), fin.getTime()));
    const cleDebut = cleJour(d);
    const cleFin = cleJour(f);

    for (
      let c = new Date(premier), garde = 0;
      c <= dernier && garde < 40;
      c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1), garde++
    ) {
      const cle = cleJour(c);
      let horaire: string;
      if (cleDebut === cleFin) horaire = `${formatHeure.format(d)} – ${formatHeure.format(f)}`;
      else if (cle === cleDebut) horaire = `À partir de ${formatHeure.format(d)}`;
      else if (cle === cleFin) horaire = `Jusqu’à ${formatHeure.format(f)}`;
      else horaire = "Toute la journée";

      const jour = jours.get(cle) ?? { cle, date: new Date(c), occurrences: [] };
      jour.occurrences.push({ evenement: e, horaire });
      jours.set(cle, jour);
    }
  }
  return [...jours.values()].sort((a, b) => a.cle.localeCompare(b.cle));
}

// Début proposé pour un nouvel événement : la prochaine heure pleine si on est dans le mois affiché, sinon le 1er à 9 h
function proposerDebut(mois: Date): Date {
  const n = new Date();
  if (cleJour(debutDuMois(n)) === cleJour(mois))
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours() + 1, 0);
  return new Date(mois.getFullYear(), mois.getMonth(), 1, 9, 0);
}

export function Evenements() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("evenements.gerer");
  const peutListerDepartements = profil.permissions.includes("utilisateurs.departements");

  const [mois, setMois] = useState(() => debutDuMois(new Date()));
  const [version, setVersion] = useState(0);
  const [formulaire, setFormulaire] = useState<{ evenement: Evenement | null; debut: Date } | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Evenement | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const debut = mois;
  const fin = finDuMois(mois);
  const cleCourante = `${cleJour(debut)}|${version}`;

  const charger = useCallback(
    async (jeton: string) => {
      const res = await api<ReponseMois>(`/evenements?debut=${cleJour(debut)}&fin=${cleJour(fin)}`, { token: jeton });
      return { cle: cleCourante, res };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cleCourante],
  );
  const liste = useDonnees(autorise, charger);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const evenements = useMemo(
    () => (liste.donnees && liste.donnees.cle === cleCourante ? liste.donnees.res.evenements : null),
    [liste.donnees, cleCourante],
  );

  const jours = useMemo(() => (evenements ? grouperParJour(evenements, debut, fin) : []), [evenements, debut, fin]);

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

  const maintenant = new Date();
  const aVenir =
    evenements?.filter((e) => lireDate(e.date_fin) >= maintenant && lireDate(e.date_debut) > maintenant).length ?? null;
  const enCours =
    evenements?.filter((e) => lireDate(e.date_debut) <= maintenant && lireDate(e.date_fin) >= maintenant).length ??
    null;
  const cleAujourdhui = cleJour(maintenant);
  const moisCourant = cleJour(debutDuMois(maintenant)) === cleJour(debut);

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function apresEnregistrement(texte: string) {
    setFormulaire(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  }

  async function annuler(e: Evenement) {
    setAAnnuler(null);
    setEnCoursId(e.id);
    try {
      await api<{ message: string }>(`/evenements/${e.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: `L’événement « ${e.titre_evenement} » a été annulé.` });
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
        Vous n’avez pas accès à la gestion des événements.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Événements</h1>
          <p className="mt-1 text-sm text-site-muted">Planifiez les événements de l’entreprise ou d’un département.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ evenement: null, debut: proposerDebut(mois) })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Nouvel événement
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
        <Stat icone={CalendarDays} libelle="Ce mois" valeur={evenements ? evenements.length : null} />
        <Stat icone={CalendarClock} libelle="À venir" valeur={aVenir} />
        <Stat icone={CalendarCheck} libelle="En cours" valeur={enCours} />
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-site-line p-4">
          <h2 className="font-display text-base font-semibold" aria-live="polite">
            {majuscule(formatMois.format(mois))}
          </h2>
          <div className="flex items-center gap-2">
            {!moisCourant && (
              <button
                type="button"
                onClick={() => setMois(debutDuMois(new Date()))}
                className="inline-flex h-8 items-center rounded-full border border-site-line px-3 text-xs font-semibold transition-colors hover:border-brand-violet/60"
              >
                Aujourd’hui
              </button>
            )}
            <button
              type="button"
              onClick={() => setMois((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label="Mois précédent"
              className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMois((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label="Mois suivant"
              className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>

        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>
              Impossible de charger les événements. Votre rôle doit aussi pouvoir consulter le calendrier et les
              événements.
            </span>
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
                <Squelette className="size-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-56" />
                  <Squelette className="h-3 w-40" />
                </div>
              </li>
            ))}
          </ul>
        ) : jours.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <CalendarDays size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">Aucun événement ce mois-ci.</p>
            <p className="mt-1 text-xs text-site-muted">Créez un événement ou changez de mois.</p>
          </div>
        ) : (
          <ul className="divide-y divide-site-line">
            {jours.map((j) => {
              const aujourdhui = j.cle === cleAujourdhui;
              return (
                <li key={j.cle} className="flex gap-4 px-5 py-4">
                  <div
                    className={cn(
                      "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl",
                      aujourdhui ? "v-gradient-btn" : "bg-brand-violet/15 text-brand-violet",
                    )}
                    aria-hidden
                  >
                    <span className="text-[10px] font-semibold uppercase leading-none tracking-wider">
                      {formatJourCourt.format(j.date).replace(".", "")}
                    </span>
                    <span className="mt-0.5 font-display text-xl font-bold leading-none tabular-nums">
                      {j.date.getDate()}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-site-muted">
                      {majuscule(formatJourLong.format(j.date))}
                      {aujourdhui && (
                        <span className="ml-2 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-brand-cyan">
                          Aujourd’hui
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-2">
                      {j.occurrences.map(({ evenement: e, horaire }) => {
                        const termine = lireDate(e.date_fin) < maintenant;
                        const occupe = enCoursId === e.id;
                        return (
                          <li
                            key={`${j.cle}-${e.id}`}
                            className={cn(
                              "flex flex-wrap items-start gap-x-4 gap-y-2 rounded-xl border border-site-line bg-site-base/40 px-4 py-3",
                              termine && "opacity-60",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{e.titre_evenement}</p>
                              <p className="mt-0.5 text-xs tabular-nums text-site-muted">
                                {horaire}
                                {lireDate(e.date_debut).toDateString() !== lireDate(e.date_fin).toDateString() && (
                                  <span className="ml-1.5">
                                    ({formatDateHeure.format(lireDate(e.date_debut))} →{" "}
                                    {formatDateHeure.format(lireDate(e.date_fin))})
                                  </span>
                                )}
                              </p>
                              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-site-muted">
                                {e.lieu && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin size={12} aria-hidden />
                                    {e.lieu}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1">
                                  <Users size={12} aria-hidden />
                                  {e.visibilite === "entreprise"
                                    ? "Toute l’entreprise"
                                    : nomDepartement(e.departement_id)}
                                </span>
                                {e.auteur && (
                                  <span>
                                    Par {e.auteur.prenom} {e.auteur.nom}
                                  </span>
                                )}
                              </p>
                              {e.description_evenement && (
                                <p className="mt-2 line-clamp-2 text-xs text-site-muted">{e.description_evenement}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <BoutonIcone
                                libelle={`Modifier ${e.titre_evenement}`}
                                disabled={occupe}
                                onClick={() => setFormulaire({ evenement: e, debut: proposerDebut(mois) })}
                              >
                                <Pencil size={16} aria-hidden />
                              </BoutonIcone>
                              <BoutonIcone
                                libelle={`Annuler ${e.titre_evenement}`}
                                danger
                                disabled={occupe}
                                onClick={() => setAAnnuler(e)}
                              >
                                <Trash2 size={16} aria-hidden />
                              </BoutonIcone>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {formulaire && (
        <EvenementFormulaire
          key={formulaire.evenement?.id ?? "nouveau"}
          evenement={formulaire.evenement}
          debutParDefaut={formulaire.debut}
          departements={departements}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aAnnuler && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-annulation-evt"
        >
          <button
            type="button"
            aria-label="Retour"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAAnnuler(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-annulation-evt" className="font-display text-base font-semibold">
              Annuler cet événement ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              L’événement « {aAnnuler.titre_evenement} » sera supprimé définitivement du calendrier. Cette action est
              irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setAAnnuler(null)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Conserver
              </button>
              <button
                type="button"
                onClick={() => annuler(aAnnuler)}
                className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Annuler l’événement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

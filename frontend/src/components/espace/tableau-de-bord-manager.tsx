"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Cake,
  CircleCheck,
  FileClock,
  MapPin,
  RefreshCw,
  ScrollText,
  TriangleAlert,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { initiales, menuPour } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { BOUTON_PETIT, Carte, EnteteCarte, Kpi, Squelette, Vide, nombre, pluriel } from "./elements-tableau";

// ---- Formes des réponses de l'API ------------------------------------------

type Personne = { id: number; nom: string; prenom: string };

type Manager = {
  genere_le: string;
  peut_publier: boolean;
  departement: {
    id: number;
    nom_departement: string;
    nb_employes: number;
    est_responsable: boolean;
    responsable: Personne | null;
  } | null;
  superieur: (Personne & { poste: string | null }) | null;
  equipe: {
    nb_directs: number;
    nb_total: number;
    arrivees_30j: number;
    fiches_incompletes: number;
    directs: (Personne & { poste: string | null; date_embauche: string | null })[];
    anniversaires: (Personne & { poste: string | null; date: string; annees: number })[];
  };
  contenus: {
    types: { type: string; libelle: string; brouillons: number; publies: number; publies_30j: number }[];
    total_brouillons: number;
    notes: {
      id: number;
      titre: string;
      numero_note: string | null;
      visibilite: "entreprise" | "departement";
      date_publication: string | null;
      nb_destinataires: number;
      nb_lectures: number;
      taux: number;
    }[];
    taux_lecture_moyen: number | null;
  };
};

type EvenementApi = { id: number; titre_evenement: string; date_debut: string; date_fin: string; lieu: string | null };

const HORIZON_EVENEMENTS_JOURS = 30;
const ACCES_RAPIDES = ["Actualités", "Annonces", "Articles", "Notes de service", "Documents", "Événements"];

// "2026-10-23 14:30:00" (heure locale, sans fuseau) -> Date
const dateLocale = (s: string) => parseISO(s.replace(" ", "T"));

function Avatar({ p, teinte = "violet" }: { p: Personne; teinte?: "violet" | "blue" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        teinte === "violet" ? "bg-brand-violet/15 text-brand-violet" : "bg-brand-blue/15 text-brand-blue",
      )}
    >
      {initiales(p)}
    </span>
  );
}

// ---- Tableau de bord --------------------------------------------------------

export function TableauDeBordManager() {
  const { profil } = useEspace();
  const peut = (permission: string) => profil.permissions.includes(permission);
  const moduleActif = (code: string) => profil.modules_actifs.includes(code);

  const voirEvenements = moduleActif("calendrier") && moduleActif("evenements") && peut("calendrier.consulter") && peut("evenements.consulter");

  const charger = useCallback((token: string) => api<Manager>("/manager/tableau-de-bord", { token }), []);
  const { donnees: d, chargement, erreur, reessayer } = useDonnees(true, charger);

  const chargerEvenements = useCallback(async (token: string) => {
    const maintenant = new Date();
    const debut = format(maintenant, "yyyy-MM-dd");
    const fin = format(addDays(maintenant, HORIZON_EVENEMENTS_JOURS), "yyyy-MM-dd");
    const r = await api<{ evenements: EvenementApi[] }>(`/evenements?debut=${debut}&fin=${fin}`, { token });
    return r.evenements
      .map((e) => ({ id: e.id, titre: e.titre_evenement, lieu: e.lieu, debut: dateLocale(e.date_debut), fin: dateLocale(e.date_fin) }))
      .filter((e) => e.fin >= maintenant)
      .sort((a, b) => a.debut.getTime() - b.debut.getTime());
  }, []);
  const evenements = useDonnees(voirEvenements, chargerEvenements);

  // Les accès rapides suivent le menu : droits et modules déjà pris en compte
  const acces = useMemo(
    () => menuPour(profil).flatMap((g) => g.entrees).filter((e) => e.href && ACCES_RAPIDES.includes(e.libelle)),
    [profil],
  );

  const aujourdhui = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const dep = d?.departement ?? null;
  const sansDepartement = d !== null && d.departement === null;

  return (
    <div className="space-y-6">
      <header className="v-noise relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-site-line bg-site-surface p-6 sm:p-7">
        <span aria-hidden className="v-gradient-btn absolute inset-x-0 top-0 h-px opacity-70" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-site-muted">Tableau de bord · Manager</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold sm:text-3xl">
            Bonjour, <span className="v-gradient-text">{profil.prenom}</span>
          </h1>
          <p className="mt-1.5 text-sm text-site-muted">
            {dep ? (
              <>
                Voici votre équipe et vos publications pour le département <span className="font-medium text-site-ink">{dep.nom_departement}</span>.
              </>
            ) : (
              <>Voici votre équipe et vos publications.</>
            )}
            {d?.superieur && (
              <>
                {" "}
                Vous êtes rattaché à{" "}
                <span className="font-medium text-site-ink">
                  {d.superieur.prenom} {d.superieur.nom}
                </span>
                .
              </>
            )}
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-site-line bg-site-base/60 px-4 py-2 text-xs text-site-muted first-letter:uppercase">
            <CalendarDays size={14} aria-hidden className="text-brand-violet" />
            {aujourdhui}
          </p>
          <button type="button" onClick={reessayer} className={cn(BOUTON_PETIT, "h-9 gap-2 px-4")} title="Actualiser les chiffres">
            <RefreshCw size={14} aria-hidden className={cn(chargement && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </header>

      {erreur ? (
        <Carte>
          <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
            <span>Impossible de charger votre tableau de bord.</span>
            <button type="button" className={BOUTON_PETIT} onClick={reessayer}>
              Réessayer
            </button>
          </div>
        </Carte>
      ) : (
        <>
          {sansDepartement && (
            <p role="status" className="flex items-start gap-3 rounded-xl border border-brand-violet/30 bg-brand-violet/5 px-4 py-3 text-sm">
              <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-violet" />
              <span>
                Aucun département ne vous est affecté. Un Manager ne publie que pour son département : vous ne pouvez donc pas publier de contenu pour
                l’instant. Demandez au RH ou à l’administrateur de vous en affecter un.
              </span>
            </p>
          )}

          {/* Accès rapides */}
          {acces.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {acces.map((e) => {
                const Icone = e.icone;
                return (
                  <Link
                    key={e.libelle}
                    href={e.href as string}
                    className="group flex items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm transition-colors hover:border-brand-violet/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                      <Icone size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.libelle}</span>
                    <ArrowRight size={16} aria-hidden className="shrink-0 text-site-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Indicateurs clés */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icone={Users}
              accent="violet"
              libelle="Équipe directe"
              valeur={d ? nombre.format(d.equipe.nb_directs) : null}
              detail={
                d
                  ? d.equipe.nb_directs === 0
                    ? "Aucun subordonné direct"
                    : `${nombre.format(d.equipe.nb_total)} ${pluriel(d.equipe.nb_total, "personne", "personnes")} au total, avec les sous-équipes`
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={Building2}
              accent="blue"
              libelle="Mon département"
              valeur={d ? (dep ? nombre.format(dep.nb_employes) : "—") : null}
              detail={
                d
                  ? dep
                    ? `${pluriel(dep.nb_employes, "employé actif", "employés actifs")} · ${dep.est_responsable ? "vous en êtes le responsable" : dep.responsable ? `responsable : ${dep.responsable.prenom} ${dep.responsable.nom}` : "sans responsable"}`
                    : "Aucun département affecté"
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={FileClock}
              accent="cyan"
              libelle="Mes brouillons"
              valeur={d ? nombre.format(d.contenus.total_brouillons) : null}
              detail={d ? (d.contenus.types.length === 0 ? "Aucun module de publication disponible" : d.contenus.total_brouillons === 0 ? "Rien en attente de publication" : "à relire et publier") : undefined}
              chargement={chargement}
            />
            <Kpi
              icone={ScrollText}
              accent="violet"
              libelle="Lecture des notes de service"
              valeur={d ? (d.contenus.taux_lecture_moyen === null ? "—" : `${d.contenus.taux_lecture_moyen} %`) : null}
              progression={d?.contenus.taux_lecture_moyen ?? 0}
              detail={d ? (d.contenus.notes.length === 0 ? "Aucune note publiée à suivre" : `moyenne sur ${d.contenus.notes.length} ${pluriel(d.contenus.notes.length, "note récente", "notes récentes")}`) : undefined}
              chargement={chargement}
            />
          </div>

          {/* Équipe directe + anniversaires */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Carte className="lg:col-span-2">
              <EnteteCarte
                icone={UsersRound}
                titre="Mon équipe directe"
                meta={d ? `${nombre.format(d.equipe.nb_directs)} ${pluriel(d.equipe.nb_directs, "personne", "personnes")}` : undefined}
              />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : d.equipe.directs.length === 0 ? (
                <Vide>Personne n’est rattaché à vous pour le moment. Le RH renseigne le supérieur de chaque employé depuis l’annuaire.</Vide>
              ) : (
                <>
                  <ul className="grid gap-x-8 sm:grid-cols-2">
                    {d.equipe.directs.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 border-b border-site-line py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                        <Avatar p={p} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {p.prenom} {p.nom}
                          </p>
                          <p className="truncate text-xs text-site-muted">{p.poste ?? "Poste non renseigné"}</p>
                        </div>
                        {p.date_embauche && (
                          <span className="shrink-0 text-[11px] tabular-nums text-site-muted">depuis {format(parseISO(p.date_embauche), "MMM yyyy", { locale: fr })}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {d.equipe.nb_directs > d.equipe.directs.length && (
                    <p className="mt-3 text-xs text-site-muted">
                      Les {d.equipe.directs.length} premiers sont affichés, par ordre alphabétique, sur {nombre.format(d.equipe.nb_directs)}.
                    </p>
                  )}
                  {(d.equipe.arrivees_30j > 0 || d.equipe.fiches_incompletes > 0) && (
                    <ul className="mt-4 flex flex-wrap gap-2 border-t border-site-line pt-4 text-xs">
                      {d.equipe.arrivees_30j > 0 && (
                        <li className="inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 font-medium">
                          <UserPlus size={12} aria-hidden className="text-brand-cyan" />
                          {nombre.format(d.equipe.arrivees_30j)} {pluriel(d.equipe.arrivees_30j, "arrivée", "arrivées")} sur 30 jours dans votre équipe
                        </li>
                      )}
                      {d.equipe.fiches_incompletes > 0 && (
                        <li className="inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 font-medium">
                          <TriangleAlert size={12} aria-hidden className="text-brand-violet" />
                          {nombre.format(d.equipe.fiches_incompletes)} {pluriel(d.equipe.fiches_incompletes, "fiche incomplète", "fiches incomplètes")}
                        </li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </Carte>

            <Carte>
              <EnteteCarte icone={Cake} titre="Anniversaires d’embauche" meta="30 prochains jours" />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 3 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : d.equipe.anniversaires.length === 0 ? (
                <Vide>Aucun anniversaire d’embauche dans votre équipe ces 30 prochains jours.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {d.equipe.anniversaires.map((p) => {
                    const jours = differenceInCalendarDays(parseISO(p.date), new Date());
                    return (
                      <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <Avatar p={p} teinte="blue" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {p.prenom} {p.nom}
                          </p>
                          <p className="truncate text-xs text-site-muted">
                            {nombre.format(p.annees)} {pluriel(p.annees, "an", "ans")} dans l’entreprise
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-site-line px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                          {jours <= 0 ? "Aujourd’hui" : jours === 1 ? "Demain" : format(parseISO(p.date), "d MMM", { locale: fr })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>
          </div>

          {/* Publications + suivi de lecture */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Carte>
              <EnteteCarte icone={FileClock} titre="Mes publications" />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Squelette key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : d.contenus.types.length === 0 ? (
                <Vide>Votre rôle ne publie dans aucun module actif.</Vide>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-sm">
                    <caption className="sr-only">Mes contenus par type</caption>
                    <thead>
                      <tr className="border-b border-site-line text-[11px] font-semibold uppercase tracking-wider text-site-muted">
                        <th scope="col" className="pb-2 text-left font-semibold">
                          Type
                        </th>
                        <th scope="col" className="pb-2 text-right font-semibold">
                          Brouillons
                        </th>
                        <th scope="col" className="pb-2 text-right font-semibold">
                          Publiés
                        </th>
                        <th scope="col" className="pb-2 text-right font-semibold">
                          30 jours
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-site-line">
                      {d.contenus.types.map((t) => (
                        <tr key={t.type}>
                          <th scope="row" className="py-3 text-left font-medium">
                            {t.libelle}
                          </th>
                          <td className={cn("py-3 text-right tabular-nums", t.brouillons > 0 ? "font-semibold text-brand-violet" : "text-site-muted")}>{nombre.format(t.brouillons)}</td>
                          <td className="py-3 text-right tabular-nums">{nombre.format(t.publies)}</td>
                          <td className="py-3 text-right tabular-nums text-site-muted">{nombre.format(t.publies_30j)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {d && !d.peut_publier && d.departement === null && d.contenus.types.length > 0 && (
                <p className="mt-4 text-xs text-site-muted">Sans département, vous ne pouvez pas créer de nouveau contenu.</p>
              )}
            </Carte>

            <Carte>
              <EnteteCarte icone={ScrollText} titre="Suivi de lecture des notes de service" meta={d && d.contenus.notes.length > 0 ? `${d.contenus.notes.length} dernières` : undefined} />
              {!d ? (
                <div className="space-y-5" aria-hidden>
                  {Array.from({ length: 3 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : d.contenus.notes.length === 0 ? (
                <Vide>Aucune note de service publiée par vous ou pour votre département.</Vide>
              ) : (
                <ul className="space-y-5">
                  {d.contenus.notes.map((n) => (
                    <li key={n.id}>
                      <div className="flex items-baseline gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium">{n.titre}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{n.taux} %</span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-site-line/70"
                        role="img"
                        aria-label={`${n.nb_lectures} lectures confirmées sur ${n.nb_destinataires} destinataires`}
                      >
                        <div className="v-gradient-btn h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(n.taux, n.nb_lectures > 0 ? 3 : 0)}%` }} />
                      </div>
                      <p className="mt-1.5 truncate text-xs text-site-muted">
                        {nombre.format(n.nb_lectures)} sur {nombre.format(n.nb_destinataires)} {pluriel(n.nb_destinataires, "destinataire", "destinataires")}
                        {n.numero_note ? ` · note n° ${n.numero_note}` : ""}
                        {n.visibilite === "departement" ? " · mon département" : " · toute l’entreprise"}
                        {n.date_publication ? ` · ${format(parseISO(n.date_publication), "d MMM yyyy", { locale: fr })}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>

          {/* Événements à venir */}
          {voirEvenements && (
            <Carte>
              <EnteteCarte
                icone={CalendarDays}
                titre="Événements à venir"
                meta={`${HORIZON_EVENEMENTS_JOURS} jours`}
                action={
                  <Link href="/espace/evenements" className={cn(BOUTON_PETIT, "gap-1.5")}>
                    Gérer <ArrowRight size={12} aria-hidden />
                  </Link>
                }
              />
              {evenements.chargement ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 3 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : evenements.erreur || !evenements.donnees ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
                  <span>Impossible de charger les événements.</span>
                  <button type="button" className={BOUTON_PETIT} onClick={evenements.reessayer}>
                    Réessayer
                  </button>
                </div>
              ) : evenements.donnees.length === 0 ? (
                <Vide>Aucun événement prévu dans les {HORIZON_EVENEMENTS_JOURS} prochains jours.</Vide>
              ) : (
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {evenements.donnees.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-center gap-3 border-b border-site-line py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                        <span className="text-[10px] font-semibold uppercase leading-none">{format(e.debut, "MMM", { locale: fr })}</span>
                        <span className="font-display text-base font-bold leading-tight tabular-nums">{format(e.debut, "d")}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.titre}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-site-muted">
                          {format(e.debut, "HH:mm")}
                          {isSameDay(e.debut, e.fin) ? ` – ${format(e.fin, "HH:mm")}` : ` → ${format(e.fin, "d MMM", { locale: fr })}`}
                          {e.lieu && (
                            <>
                              <MapPin size={11} aria-hidden className="shrink-0" />
                              <span className="truncate">{e.lieu}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          )}

          {d && (
            <p className="flex items-center justify-center gap-2 text-center text-xs text-site-muted">
              <CircleCheck size={12} aria-hidden />
              Chiffres calculés le {format(parseISO(d.genere_le), "d MMMM yyyy 'à' HH:mm", { locale: fr })}, sur votre équipe et vos contenus.
            </p>
          )}
        </>
      )}
    </div>
  );
}

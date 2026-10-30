"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Cake,
  CircleCheck,
  ClipboardCheck,
  Contact,
  PieChart,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { initiales } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { Anneau, CourbeAire, COULEURS_SERIE } from "./graphiques";
import {
  BarreTaux,
  BOUTON_PETIT,
  Carte,
  EnteteCarte,
  Kpi,
  Squelette,
  Vide,
  decimal,
  nombre,
  pluriel,
  pourcent,
} from "./elements-tableau";


type Personne = { id: number; nom: string; prenom: string };

type Champ = "poste" | "telephone" | "departement" | "superieur" | "date_embauche";

type Rh = {
  genere_le: string;
  effectif: {
    total: number;
    actifs: number;
    inactifs: number;
    arrivees_30j: number;
    avec_date_embauche: number;
    anciennete_moyenne_annees: number | null;
  };
  arrivees_par_mois: { mois: string; arrivees: number }[];
  departements: { id: number | null; nom_departement: string; nb_employes: number }[];
  roles: { nom_role: string; nb_utilisateurs: number }[];
  dernieres_arrivees: (Personne & { poste: string | null; departement: string | null; date_embauche: string })[];
  anniversaires: (Personne & { poste: string | null; date: string; annees: number })[];
  fiches: {
    total: number;
    completes: number;
    taux_completude: number;
    manques: Record<Champ, number>;
    a_completer: (Personne & { manque: Champ[] })[];
  };
  alertes: {
    departements_sans_responsable: { total: number; departements: { id: number; nom_departement: string }[] };
    comptes_inactifs: { total: number; comptes: (Personne & { poste: string | null })[] };
  };
};

const LIBELLE_CHAMP: Record<Champ, string> = {
  poste: "Poste",
  telephone: "Téléphone",
  departement: "Département",
  superieur: "Supérieur",
  date_embauche: "Date d’embauche",
};

const ORDRE_CHAMPS: Champ[] = ["departement", "poste", "superieur", "telephone", "date_embauche"];

const dateLongue = (iso: string) => format(parseISO(iso), "d MMM yyyy", { locale: fr });

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

function LienCarte({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(BOUTON_PETIT, "gap-1.5")}>
      {children} <ArrowRight size={12} aria-hidden />
    </Link>
  );
}

function ActionRapide({
  href,
  icone: Icone,
  libelle,
  detail,
}: {
  href: string;
  icone: LucideIcon;
  libelle: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm transition-colors hover:border-brand-violet/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Icone size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{libelle}</span>
        <span className="block truncate text-xs text-site-muted">{detail}</span>
      </span>
      <ArrowRight
        size={16}
        aria-hidden
        className="shrink-0 text-site-muted transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function Point({
  icone: Icone,
  titre,
  aide,
  total,
  ton,
  children,
}: {
  icone: LucideIcon;
  titre: string;
  aide: string;
  total: number;
  ton: "danger" | "neutre";
  children?: ReactNode;
}) {
  const rien = total === 0;
  return (
    <li
      className={cn(
        "rounded-xl border p-4",
        rien
          ? "border-site-line"
          : ton === "danger"
            ? "border-site-danger/40 bg-site-danger/5"
            : "border-brand-violet/30 bg-brand-violet/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            rien
              ? "bg-brand-cyan/15 text-brand-cyan"
              : ton === "danger"
                ? "bg-site-danger/15 text-site-danger"
                : "bg-brand-violet/15 text-brand-violet",
          )}
        >
          {rien ? <CircleCheck size={17} aria-hidden /> : <Icone size={17} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {titre} <span className="font-display tabular-nums">· {nombre.format(total)}</span>
          </p>
          <p className="mt-0.5 text-xs text-site-muted">{rien ? "Rien à signaler." : aide}</p>
          {!rien && children}
        </div>
      </div>
    </li>
  );
}

// ---- Tableau de bord --------------------------------------------------------

export function TableauDeBordRH() {
  const { profil } = useEspace();
  const charger = useCallback((token: string) => api<Rh>("/rh/tableau-de-bord", { token }), []);
  const { donnees: d, chargement, erreur, reessayer } = useDonnees(true, charger);

  const aujourdhui = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  const arrivees = useMemo(
    () =>
      (d?.arrivees_par_mois ?? []).map((m) => {
        const date = parseISO(`${m.mois}-01`);
        return {
          label: format(date, "MMM yy", { locale: fr }),
          valeur: m.arrivees,
          infobulle: `${format(date, "MMMM yyyy", { locale: fr })} : ${m.arrivees}`,
        };
      }),
    [d],
  );
  const totalArrivees = arrivees.reduce((s, x) => s + x.valeur, 0);
  const totalRoles = d?.roles.reduce((s, r) => s + r.nb_utilisateurs, 0) ?? 0;
  const departements = d?.departements.filter((x) => x.nb_employes > 0 || x.id !== null) ?? [];
  const maxDepartement = Math.max(1, ...departements.map((x) => x.nb_employes));
  const nbPoints = d
    ? d.alertes.departements_sans_responsable.total +
      d.alertes.comptes_inactifs.total +
      (d.fiches.completes < d.fiches.total ? 1 : 0)
    : 0;

  const champsManquants = d ? ORDRE_CHAMPS.filter((c) => d.fiches.manques[c] > 0) : [];

  return (
    <div className="space-y-6">
      <header className="v-noise relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-site-line bg-site-surface p-6 sm:p-7">
        <span aria-hidden className="v-gradient-btn absolute inset-x-0 top-0 h-px opacity-70" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-site-muted">
            Tableau de bord · Ressources humaines
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold sm:text-3xl">
            Bonjour, <span className="v-gradient-text">{profil.prenom}</span>
          </h1>
          <p className="mt-1.5 text-sm text-site-muted">
            Voici les effectifs et le suivi des fiches de{" "}
            <span className="font-medium text-site-ink">{profil.entreprise}</span>.
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-site-line bg-site-base/60 px-4 py-2 text-xs text-site-muted first-letter:uppercase">
            <CalendarDays size={14} aria-hidden className="text-brand-violet" />
            {aujourdhui}
          </p>
          <button
            type="button"
            onClick={reessayer}
            className={cn(BOUTON_PETIT, "h-9 gap-2 px-4")}
            title="Actualiser les chiffres"
          >
            <RefreshCw size={14} aria-hidden className={cn(chargement && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </header>

      {erreur ? (
        <Carte>
          <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
            <span>Impossible de charger le tableau de bord RH.</span>
            <button type="button" className={BOUTON_PETIT} onClick={reessayer}>
              Réessayer
            </button>
          </div>
        </Carte>
      ) : (
        <>
          {/* Accès rapides */}
          <div className="grid gap-4 sm:grid-cols-3">
            <ActionRapide
              href="/espace/utilisateurs"
              icone={UserPlus}
              libelle="Gérer les employés"
              detail="Créer, modifier ou désactiver un compte"
            />
            <ActionRapide
              href="/espace/departements"
              icone={Building2}
              libelle="Départements"
              detail="Structure et responsables"
            />
            <ActionRapide
              href="/espace/annuaire"
              icone={Contact}
              libelle="Annuaire et organigramme"
              detail="Fiches et hiérarchie"
            />
          </div>

          {/* Indicateurs clés */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icone={Users}
              accent="violet"
              libelle="Effectif actif"
              valeur={d ? nombre.format(d.effectif.actifs) : null}
              progression={d ? pourcent(d.effectif.actifs, d.effectif.total) : 0}
              detail={
                d
                  ? `${nombre.format(d.effectif.total)} comptes au total · ${nombre.format(d.effectif.inactifs)} ${pluriel(d.effectif.inactifs, "inactif", "inactifs")}`
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={UserPlus}
              accent="cyan"
              libelle="Arrivées sur 30 jours"
              valeur={d ? nombre.format(d.effectif.arrivees_30j) : null}
              detail={
                d
                  ? `${nombre.format(totalArrivees)} ${pluriel(totalArrivees, "arrivée", "arrivées")} sur 12 mois`
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={UserCheck}
              accent="blue"
              libelle="Ancienneté moyenne"
              valeur={
                d
                  ? d.effectif.anciennete_moyenne_annees === null
                    ? "—"
                    : `${decimal.format(d.effectif.anciennete_moyenne_annees)} ${d.effectif.anciennete_moyenne_annees > 1 ? "ans" : "an"}`
                  : null
              }
              detail={
                d
                  ? d.effectif.avec_date_embauche < d.effectif.actifs
                    ? `calculée sur ${nombre.format(d.effectif.avec_date_embauche)} fiches avec date d’embauche`
                    : "sur l’ensemble des comptes actifs"
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={ClipboardCheck}
              accent="violet"
              libelle="Fiches complètes"
              valeur={d ? `${d.fiches.taux_completude} %` : null}
              progression={d ? d.fiches.taux_completude : 0}
              detail={
                d
                  ? `${nombre.format(d.fiches.completes)} sur ${nombre.format(d.fiches.total)} comptes actifs`
                  : undefined
              }
              chargement={chargement}
            />
          </div>

          {/* Arrivées + rôles */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Carte className="lg:col-span-2">
              <EnteteCarte
                icone={TrendingUp}
                titre="Arrivées par mois"
                meta={
                  d
                    ? `12 mois · ${nombre.format(totalArrivees)} ${pluriel(totalArrivees, "arrivée", "arrivées")}`
                    : "12 mois"
                }
              />
              {!d ? (
                <Squelette className="h-72 w-full" />
              ) : (
                <>
                  <CourbeAire
                    donnees={arrivees}
                    unite={{ un: "arrivée", plusieurs: "arrivées" }}
                    prefixeDate="Mois :"
                    description={`Arrivées par mois sur 12 mois, ${totalArrivees} au total, d’après la date d’embauche.`}
                  />
                  {d.effectif.avec_date_embauche < d.effectif.actifs && (
                    <p className="mt-4 text-xs text-site-muted">
                      {nombre.format(d.effectif.actifs - d.effectif.avec_date_embauche)}{" "}
                      {pluriel(
                        d.effectif.actifs - d.effectif.avec_date_embauche,
                        "compte actif n’a",
                        "comptes actifs n’ont",
                      )}{" "}
                      pas de date d’embauche : ils ne sont pas comptés ici.
                    </p>
                  )}
                </>
              )}
            </Carte>

            <Carte>
              <EnteteCarte icone={PieChart} titre="Effectif par rôle" />
              {!d ? (
                <Squelette className="mx-auto size-48 rounded-full" />
              ) : totalRoles === 0 ? (
                <Vide>Aucun compte actif pour le moment.</Vide>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <Anneau
                    segments={d.roles.map((r, i) => ({
                      label: r.nom_role,
                      valeur: r.nb_utilisateurs,
                      couleur: COULEURS_SERIE[i % COULEURS_SERIE.length],
                    }))}
                    centreValeur={nombre.format(totalRoles)}
                    centreLibelle={pluriel(totalRoles, "compte actif", "comptes actifs")}
                    description={`Répartition de ${totalRoles} comptes actifs par rôle.`}
                  />
                  <ul className="w-full space-y-2.5 text-sm">
                    {d.roles.map((r, i) => (
                      <li key={r.nom_role} className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: COULEURS_SERIE[i % COULEURS_SERIE.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate">{r.nom_role}</span>
                        <span className="font-semibold tabular-nums">{nombre.format(r.nb_utilisateurs)}</span>
                        <span className="w-10 text-right text-xs tabular-nums text-site-muted">
                          {pourcent(r.nb_utilisateurs, totalRoles)} %
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Carte>
          </div>

          {/* Départements + arrivées récentes */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Carte className="lg:col-span-2">
              <EnteteCarte
                icone={Building2}
                titre="Effectif par département"
                meta={
                  d
                    ? `${nombre.format(d.departements.filter((x) => x.id !== null).length)} ${pluriel(d.departements.filter((x) => x.id !== null).length, "département", "départements")}`
                    : undefined
                }
                action={<LienCarte href="/espace/departements">Départements</LienCarte>}
              />
              {!d ? (
                <div className="space-y-5" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Squelette key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : departements.length === 0 ? (
                <Vide>Aucun département pour le moment.</Vide>
              ) : (
                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {departements.map((x, i) => (
                    <BarreTaux
                      key={x.id ?? "sans"}
                      rang={i + 1}
                      libelle={x.nom_departement}
                      valeur={x.nb_employes}
                      total={maxDepartement}
                      sousTitre={x.id === null ? "Comptes actifs sans département" : undefined}
                    />
                  ))}
                </ul>
              )}
            </Carte>

            <Carte>
              <EnteteCarte icone={UserPlus} titre="Dernières arrivées" />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : d.dernieres_arrivees.length === 0 ? (
                <Vide>Aucune date d’embauche renseignée.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {d.dernieres_arrivees.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar p={p} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {p.prenom} {p.nom}
                        </p>
                        <p className="truncate text-xs text-site-muted">
                          {[p.poste, p.departement].filter(Boolean).join(" · ") || "Poste non renseigné"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-site-muted">
                        {dateLongue(p.date_embauche)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>

          {/* Anniversaires + points d'attention */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Carte>
              <EnteteCarte icone={Cake} titre="Anniversaires d’embauche" meta="30 prochains jours" />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : d.anniversaires.length === 0 ? (
                <Vide>Aucun anniversaire d’embauche dans les 30 prochains jours.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {d.anniversaires.map((p) => {
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
                            {p.poste ? ` · ${p.poste}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-site-line px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                          {jours <= 0
                            ? "Aujourd’hui"
                            : jours === 1
                              ? "Demain"
                              : format(parseISO(p.date), "d MMM", { locale: fr })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>

            <Carte>
              <EnteteCarte
                icone={ClipboardCheck}
                titre="Points d’attention"
                meta={d ? (nbPoints === 0 ? "Tout est en ordre" : `${nombre.format(nbPoints)} à examiner`) : undefined}
              />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 3 }, (_, i) => (
                    <Squelette key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  <Point
                    icone={ClipboardCheck}
                    ton="neutre"
                    titre="Fiches incomplètes"
                    total={d.fiches.total - d.fiches.completes}
                    aide="Complétez-les depuis l’annuaire ou l’écran Utilisateurs."
                  >
                    {champsManquants.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {champsManquants.map((c) => (
                          <li
                            key={c}
                            className="rounded-full border border-site-line bg-site-surface px-2.5 py-0.5 text-[11px] font-medium"
                          >
                            {LIBELLE_CHAMP[c]}{" "}
                            <span className="tabular-nums text-site-muted">· {nombre.format(d.fiches.manques[c])}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.fiches.a_completer.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-site-muted">
                        {d.fiches.a_completer.map((p) => (
                          <li key={p.id} className="truncate">
                            <span className="font-medium text-site-ink">
                              {p.prenom} {p.nom}
                            </span>{" "}
                            : {p.manque.map((c) => LIBELLE_CHAMP[c].toLowerCase()).join(", ")}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Point>
                  <Point
                    icone={Building2}
                    ton="neutre"
                    titre="Départements sans responsable"
                    total={d.alertes.departements_sans_responsable.total}
                    aide="Aucun responsable actif n’est désigné. Désignez-en un depuis l’écran Départements."
                  >
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {d.alertes.departements_sans_responsable.departements.map((x) => (
                        <li
                          key={x.id}
                          className="max-w-full truncate rounded-full border border-site-line bg-site-surface px-2.5 py-0.5 text-[11px] font-medium"
                        >
                          {x.nom_departement}
                        </li>
                      ))}
                      {d.alertes.departements_sans_responsable.total >
                        d.alertes.departements_sans_responsable.departements.length && (
                        <li className="px-1 py-0.5 text-[11px] text-site-muted">
                          et{" "}
                          {nombre.format(
                            d.alertes.departements_sans_responsable.total -
                              d.alertes.departements_sans_responsable.departements.length,
                          )}{" "}
                          de plus
                        </li>
                      )}
                    </ul>
                  </Point>
                  <Point
                    icone={UserX}
                    ton="neutre"
                    titre="Comptes désactivés"
                    total={d.alertes.comptes_inactifs.total}
                    aide="Ces comptes ne peuvent plus se connecter. Vous pouvez les réactiver depuis l’écran Utilisateurs."
                  >
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {d.alertes.comptes_inactifs.comptes.map((p) => (
                        <li
                          key={p.id}
                          className="max-w-full truncate rounded-full border border-site-line bg-site-surface px-2.5 py-0.5 text-[11px] font-medium"
                        >
                          {p.prenom} {p.nom}
                        </li>
                      ))}
                      {d.alertes.comptes_inactifs.total > d.alertes.comptes_inactifs.comptes.length && (
                        <li className="px-1 py-0.5 text-[11px] text-site-muted">
                          et{" "}
                          {nombre.format(d.alertes.comptes_inactifs.total - d.alertes.comptes_inactifs.comptes.length)}{" "}
                          de plus
                        </li>
                      )}
                    </ul>
                  </Point>
                </ul>
              )}
            </Carte>
          </div>

          {d && (
            <p className="text-center text-xs text-site-muted">
              Chiffres calculés le {format(parseISO(d.genere_le), "d MMMM yyyy 'à' HH:mm", { locale: fr })}, sur les
              comptes de votre entreprise.
            </p>
          )}
        </>
      )}
    </div>
  );
}

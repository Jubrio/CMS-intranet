"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowRight,
  Blocks,
  Building2,
  CalendarDays,
  CircleCheck,
  KeyRound,
  PauseCircle,
  PieChart,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Trophy,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { iconeModule } from "@/lib/module-icons";
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

// ---- Formes des réponses de l'API ------------------------------------------

type EntrepriseResume = {
  id: number;
  nom_entreprise: string;
  slug: string;
  statut_entreprise: "active" | "suspendue";
  nb_utilisateurs: number;
};

type Echantillon = { total: number; entreprises: { id: number; nom_entreprise: string; slug: string }[] };

type Plateforme = {
  genere_le: string;
  entreprises: { total: number; actives: number; suspendues: number; nouvelles_7j: number; nouvelles_30j: number };
  utilisateurs: {
    total: number;
    actifs: number;
    inactifs: number;
    nouveaux_30j: number;
    moyenne_par_entreprise: number;
  };
  modules: {
    total: number;
    moyenne_optionnels_par_entreprise: number;
    adoption: { code_module: string; nom_module: string; module_obligatoire: boolean; nb_entreprises: number }[];
  };
  croissance: { mois: string; entreprises: number; utilisateurs: number }[];
  roles: { nom_role: string; nb_utilisateurs: number }[];
  plus_grandes: EntrepriseResume[];
  dernieres: (EntrepriseResume & { created_at: string | null })[];
  alertes: {
    suspendues: Echantillon;
    sans_administrateur_actif: Echantillon;
    sans_module_optionnel: Echantillon;
  };
};

function PastilleStatut({ statut }: { statut: "active" | "suspendue" }) {
  const active = statut === "active";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        active ? "bg-brand-cyan/15 text-brand-cyan" : "bg-site-danger/15 text-site-danger",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-brand-cyan" : "bg-site-danger")} />
      {active ? "Active" : "Suspendue"}
    </span>
  );
}

function initialesEntreprise(nom: string) {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

function Alerte({
  icone: Icone,
  titre,
  aide,
  echantillon,
  ton,
}: {
  icone: LucideIcon;
  titre: string;
  aide: string;
  echantillon: Echantillon;
  ton: "danger" | "neutre";
}) {
  const rien = echantillon.total === 0;
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
            {titre} <span className="font-display tabular-nums">· {nombre.format(echantillon.total)}</span>
          </p>
          <p className="mt-0.5 text-xs text-site-muted">{rien ? "Rien à signaler." : aide}</p>
          {!rien && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {echantillon.entreprises.map((e) => (
                <li
                  key={e.id}
                  className="max-w-full truncate rounded-full border border-site-line bg-site-surface px-2.5 py-0.5 text-[11px] font-medium"
                >
                  {e.nom_entreprise}
                </li>
              ))}
              {echantillon.total > echantillon.entreprises.length && (
                <li className="px-1 py-0.5 text-[11px] text-site-muted">
                  et {nombre.format(echantillon.total - echantillon.entreprises.length)} de plus
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

// ---- Tableau de bord --------------------------------------------------------

type Serie = "utilisateurs" | "entreprises";

const SERIES: Record<Serie, { libelle: string; unite: { un: string; plusieurs: string }; verbe: string }> = {
  utilisateurs: { libelle: "Comptes", unite: { un: "nouveau compte", plusieurs: "nouveaux comptes" }, verbe: "créés" },
  entreprises: {
    libelle: "Entreprises",
    unite: { un: "nouvelle entreprise", plusieurs: "nouvelles entreprises" },
    verbe: "créées",
  },
};

export function TableauDeBordPlateforme() {
  const { profil } = useEspace();
  const [serie, setSerie] = useState<Serie>("utilisateurs");

  const charger = useCallback((token: string) => api<Plateforme>("/super/tableau-de-bord", { token }), []);
  const { donnees: d, chargement, erreur, reessayer } = useDonnees(true, charger);

  const aujourdhui = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  const croissance = useMemo(
    () =>
      (d?.croissance ?? []).map((m) => {
        const date = parseISO(`${m.mois}-01`);
        const valeur = serie === "utilisateurs" ? m.utilisateurs : m.entreprises;
        return {
          label: format(date, "MMM yy", { locale: fr }),
          valeur,
          infobulle: `${format(date, "MMMM yyyy", { locale: fr })} : ${valeur}`,
        };
      }),
    [d, serie],
  );
  const totalSerie = croissance.reduce((s, x) => s + x.valeur, 0);

  const optionnels = useMemo(
    () =>
      (d?.modules.adoption ?? [])
        .filter((m) => !m.module_obligatoire)
        .sort((a, b) => b.nb_entreprises - a.nb_entreprises || a.nom_module.localeCompare(b.nom_module, "fr")),
    [d],
  );
  const totalRoles = d?.roles.reduce((s, r) => s + r.nb_utilisateurs, 0) ?? 0;
  const maxTaille = d ? Math.max(1, ...d.plus_grandes.map((e) => e.nb_utilisateurs)) : 1;

  const nbAlertes = d
    ? d.alertes.suspendues.total + d.alertes.sans_administrateur_actif.total + d.alertes.sans_module_optionnel.total
    : 0;

  return (
    <div className="space-y-6">
      <header className="v-noise relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-site-line bg-site-surface p-6 sm:p-7">
        <span aria-hidden className="v-gradient-btn absolute inset-x-0 top-0 h-px opacity-70" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-site-muted">Tableau de bord</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold sm:text-3xl">
            Bonjour, <span className="v-gradient-text">{profil.prenom}</span>
          </h1>
          <p className="mt-1.5 text-sm text-site-muted">
            Voici l&apos;état de la plateforme et de tous les intranets qu&apos;elle héberge.
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
            <span>Impossible de charger le tableau de bord.</span>
            <button type="button" className={BOUTON_PETIT} onClick={reessayer}>
              Réessayer
            </button>
          </div>
        </Carte>
      ) : (
        <>
          {/* Indicateurs clés */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icone={Building2}
              accent="violet"
              libelle="Entreprises"
              valeur={d ? nombre.format(d.entreprises.total) : null}
              detail={
                d
                  ? `+${nombre.format(d.entreprises.nouvelles_30j)} sur 30 jours · +${nombre.format(d.entreprises.nouvelles_7j)} sur 7 jours`
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={CircleCheck}
              accent="cyan"
              libelle="Intranets actifs"
              valeur={d ? `${nombre.format(d.entreprises.actives)} / ${nombre.format(d.entreprises.total)}` : null}
              progression={d ? pourcent(d.entreprises.actives, d.entreprises.total) : 0}
              detail={
                d
                  ? d.entreprises.suspendues === 0
                    ? "Aucun intranet suspendu"
                    : `${nombre.format(d.entreprises.suspendues)} ${pluriel(d.entreprises.suspendues, "intranet suspendu", "intranets suspendus")}`
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={Users}
              accent="blue"
              libelle="Comptes utilisateurs"
              valeur={d ? nombre.format(d.utilisateurs.total) : null}
              progression={d ? pourcent(d.utilisateurs.actifs, d.utilisateurs.total) : 0}
              detail={
                d
                  ? `${nombre.format(d.utilisateurs.actifs)} actifs · ${nombre.format(d.utilisateurs.inactifs)} ${pluriel(d.utilisateurs.inactifs, "inactif", "inactifs")} · +${nombre.format(d.utilisateurs.nouveaux_30j)} sur 30 jours`
                  : undefined
              }
              chargement={chargement}
            />
            <Kpi
              icone={Blocks}
              accent="violet"
              libelle="Modules optionnels par intranet"
              valeur={d ? decimal.format(d.modules.moyenne_optionnels_par_entreprise) : null}
              detail={
                d
                  ? `en moyenne · ${decimal.format(d.utilisateurs.moyenne_par_entreprise)} comptes par entreprise`
                  : undefined
              }
              chargement={chargement}
            />
          </div>

          {/* Croissance + comptes par rôle */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Carte className="lg:col-span-2">
              <EnteteCarte
                icone={TrendingUp}
                titre="Croissance de la plateforme"
                meta={d ? `12 mois · ${nombre.format(totalSerie)} ${SERIES[serie].verbe}` : "12 mois"}
                action={
                  <div
                    role="group"
                    aria-label="Série affichée"
                    className="flex rounded-full border border-site-line p-0.5"
                  >
                    {(Object.keys(SERIES) as Serie[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={serie === s}
                        onClick={() => setSerie(s)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                          serie === s ? "v-gradient-btn" : "text-site-muted hover:text-site-ink",
                        )}
                      >
                        {SERIES[s].libelle}
                      </button>
                    ))}
                  </div>
                }
              />
              {!d ? (
                <Squelette className="h-72 w-full" />
              ) : (
                <CourbeAire
                  donnees={croissance}
                  unite={SERIES[serie].unite}
                  prefixeDate="Mois :"
                  description={`${SERIES[serie].libelle} ${SERIES[serie].verbe} par mois sur 12 mois, ${totalSerie} au total.`}
                />
              )}
            </Carte>

            <Carte>
              <EnteteCarte icone={PieChart} titre="Comptes par rôle" />
              {!d ? (
                <Squelette className="mx-auto size-48 rounded-full" />
              ) : totalRoles === 0 ? (
                <Vide>Aucun compte pour le moment.</Vide>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <Anneau
                    segments={d.roles.map((r, i) => ({
                      label: r.nom_role,
                      valeur: r.nb_utilisateurs,
                      couleur: COULEURS_SERIE[i % COULEURS_SERIE.length],
                    }))}
                    centreValeur={nombre.format(totalRoles)}
                    centreLibelle={pluriel(totalRoles, "compte", "comptes")}
                    description={`Répartition de ${totalRoles} comptes par rôle, toutes entreprises confondues.`}
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

          {/* Adoption des modules + plus grandes entreprises */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Carte className="lg:col-span-2">
              <EnteteCarte
                icone={KeyRound}
                titre="Adoption des modules optionnels"
                meta={
                  d
                    ? `sur ${nombre.format(d.entreprises.total)} ${pluriel(d.entreprises.total, "entreprise", "entreprises")}`
                    : undefined
                }
                action={
                  <Link href="/espace/catalogue-modules" className={cn(BOUTON_PETIT, "gap-1.5")}>
                    Catalogue <ArrowRight size={12} aria-hidden />
                  </Link>
                }
              />
              {!d ? (
                <div className="space-y-5" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Squelette key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : optionnels.length === 0 ? (
                <Vide>Aucun module optionnel au catalogue.</Vide>
              ) : (
                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {optionnels.map((m) => (
                    <BarreTaux
                      key={m.code_module}
                      libelle={m.nom_module}
                      valeur={m.nb_entreprises}
                      total={d.entreprises.total}
                      icone={iconeModule(m.code_module)}
                    />
                  ))}
                </ul>
              )}
            </Carte>

            <Carte>
              <EnteteCarte icone={Trophy} titre="Plus grands intranets" meta="par comptes" />
              {!d ? (
                <div className="space-y-5" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Squelette key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : d.plus_grandes.length === 0 ? (
                <Vide>Aucune entreprise pour le moment.</Vide>
              ) : (
                <ul className="space-y-5">
                  {d.plus_grandes.map((e, i) => (
                    <BarreTaux
                      key={e.id}
                      rang={i + 1}
                      libelle={e.nom_entreprise}
                      valeur={e.nb_utilisateurs}
                      total={maxTaille}
                      sousTitre={e.statut_entreprise === "suspendue" ? "Intranet suspendu" : undefined}
                    />
                  ))}
                </ul>
              )}
            </Carte>
          </div>

          {/* Dernières créations + points d'attention */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Carte>
              <EnteteCarte
                icone={Building2}
                titre="Derniers intranets créés"
                action={
                  <Link href="/espace/intranets" className={cn(BOUTON_PETIT, "gap-1.5")}>
                    Tout voir <ArrowRight size={12} aria-hidden />
                  </Link>
                }
              />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Squelette key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : d.dernieres.length === 0 ? (
                <Vide>Aucune entreprise pour le moment.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {d.dernieres.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                          e.statut_entreprise === "suspendue"
                            ? "bg-site-line text-site-muted"
                            : "bg-brand-violet/15 text-brand-violet",
                        )}
                      >
                        {initialesEntreprise(e.nom_entreprise)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.nom_entreprise}</p>
                        <p className="truncate text-xs text-site-muted">
                          {e.created_at
                            ? `Créé le ${format(parseISO(e.created_at), "d MMM yyyy", { locale: fr })}`
                            : "Date inconnue"}{" "}
                          · {nombre.format(e.nb_utilisateurs)} {pluriel(e.nb_utilisateurs, "compte", "comptes")}
                        </p>
                      </div>
                      <PastilleStatut statut={e.statut_entreprise} />
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            <Carte>
              <EnteteCarte
                icone={ShieldAlert}
                titre="Points d’attention"
                meta={
                  d ? (nbAlertes === 0 ? "Tout est en ordre" : `${nombre.format(nbAlertes)} à examiner`) : undefined
                }
              />
              {!d ? (
                <div className="space-y-4" aria-hidden>
                  {Array.from({ length: 3 }, (_, i) => (
                    <Squelette key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  <Alerte
                    icone={PauseCircle}
                    ton="neutre"
                    titre="Intranets suspendus"
                    aide="Leurs comptes ne peuvent pas se connecter. Réactivez-les depuis l’écran Intranets."
                    echantillon={d.alertes.suspendues}
                  />
                  <Alerte
                    icone={UserX}
                    ton="danger"
                    titre="Sans administrateur actif"
                    aide="Personne ne peut gérer ces intranets : aucun compte Administrateur n’est actif."
                    echantillon={d.alertes.sans_administrateur_actif}
                  />
                  <Alerte
                    icone={Blocks}
                    ton="neutre"
                    titre="Aucun module optionnel"
                    aide="Ces intranets actifs n’utilisent que les fonctionnalités de base : ils ne sont probablement pas encore adoptés."
                    echantillon={d.alertes.sans_module_optionnel}
                  />
                </ul>
              )}
            </Carte>
          </div>

          {d && (
            <p className="text-center text-xs text-site-muted">
              Chiffres calculés le {format(parseISO(d.genere_le), "d MMMM yyyy 'à' HH:mm", { locale: fr })}. Les
              contenus des entreprises ne sont jamais consultés par la plateforme.
            </p>
          )}
        </>
      )}
    </div>
  );
}

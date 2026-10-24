"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import {
  addDays,
  differenceInCalendarWeeks,
  format,
  formatDistanceToNow,
  isSameDay,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Blocks,
  Building2,
  CalendarDays,
  FileClock,
  Newspaper,
  PieChart,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { iconeModule } from "@/lib/module-icons";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { Anneau, CourbeAire, COULEURS_SERIE, ListeBarres } from "./graphiques";

// ---- Formes des réponses de l'API ------------------------------------------

type PageTotal = { total: number };

type DepartementResume = {
  id: number;
  nom_departement: string;
  nb_employes: number;
  responsable: { id: number; nom: string; prenom: string } | null;
};

type ModuleEtat = {
  code_module: string;
  nom_module: string;
  description_module: string;
  module_obligatoire: boolean;
  actif: boolean;
};

type RoleResume = { id: number; nom_role: string; nb_utilisateurs: number };

type ContenuLigne = {
  id: number;
  titre: string;
  date_publication: string | null;
  auteur: { nom: string; prenom: string } | null;
};
type PageContenus = { data: ContenuLigne[]; total: number };

type EvenementApi = { id: number; titre_evenement: string; date_debut: string; date_fin: string; lieu: string | null };

// Types de contenu et module associé (même correspondance que Contenu::MODULES côté Laravel)
const TYPES_CONTENU = [
  { type: "actualite", libelle: "Actualités", module: "actualites" },
  { type: "annonce", libelle: "Annonces", module: "annonces" },
  { type: "article", libelle: "Articles", module: "articles" },
  { type: "note_service", libelle: "Notes de service", module: "notes_service" },
] as const;

const NB_SEMAINES = 8;
const HORIZON_EVENEMENTS_JOURS = 30;

const nombre = new Intl.NumberFormat("fr-FR");
const pluriel = (n: number, singulier: string, plur: string) => (n > 1 ? plur : singulier);

// "2026-10-23 14:30:00" (heure locale, sans fuseau) -> Date
const dateLocale = (s: string) => parseISO(s.replace(" ", "T"));

const BOUTON_PETIT =
  "inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60";

// ---- Éléments d'affichage ---------------------------------------------------

type Accent = "violet" | "blue" | "cyan";

const ACCENTS: Record<Accent, { tuile: string; halo: string; texte: string }> = {
  violet: { tuile: "bg-brand-violet/15 text-brand-violet", halo: "bg-brand-violet/20", texte: "text-brand-violet" },
  blue: { tuile: "bg-brand-blue/15 text-brand-blue", halo: "bg-brand-blue/20", texte: "text-brand-blue" },
  cyan: { tuile: "bg-brand-cyan/15 text-brand-cyan", halo: "bg-brand-cyan/20", texte: "text-brand-cyan" },
};

function Carte({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm sm:p-6", className)}>
      {children}
    </section>
  );
}

function EnteteCarte({ icone: Icone, titre, meta }: { icone: LucideIcon; titre: string; meta?: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Icone size={17} aria-hidden />
      </span>
      <h2 className="font-display text-[15px] font-semibold">{titre}</h2>
      {meta && (
        <span className="ml-auto shrink-0 rounded-full border border-site-line bg-site-base/50 px-2.5 py-1 text-[11px] text-site-muted">
          {meta}
        </span>
      )}
    </div>
  );
}

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function ErreurBloc({ onReessayer }: { onReessayer: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
      <span>Impossible de charger cette section.</span>
      <button type="button" className={BOUTON_PETIT} onClick={onReessayer}>
        Réessayer
      </button>
    </div>
  );
}

function Vide({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-site-muted">{children}</p>;
}

type KpiProps = {
  icone: LucideIcon;
  accent: Accent;
  libelle: string;
  valeur: string | null;
  detail?: string;
  // 0 à 100 : jauge sous le chiffre
  progression?: number;
  chargement: boolean;
  erreur: boolean;
  onReessayer: () => void;
};

function Kpi({
  icone: Icone,
  accent,
  libelle,
  valeur,
  detail,
  progression,
  chargement,
  erreur,
  onReessayer,
}: KpiProps) {
  const a = ACCENTS[accent];
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm transition-colors hover:border-brand-violet/40 sm:p-6">
      <span
        aria-hidden
        className={cn("pointer-events-none absolute -right-8 -top-12 size-36 rounded-full blur-3xl", a.halo)}
      />
      <span aria-hidden className="v-gradient-btn absolute inset-x-0 top-0 h-px opacity-70" />
      <div className="relative flex items-center gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", a.tuile)}>
          <Icone size={20} aria-hidden />
        </span>
        <h2 className="text-sm font-medium text-site-muted">{libelle}</h2>
      </div>
      <div className="relative mt-5">
        {chargement ? (
          <>
            <Squelette className="h-10 w-24" />
            <Squelette className="mt-3 h-3.5 w-32" />
          </>
        ) : erreur ? (
          <ErreurBloc onReessayer={onReessayer} />
        ) : (
          <>
            <p className="font-display text-[2.5rem] font-bold leading-none tabular-nums">{valeur}</p>
            {progression !== undefined && (
              <div aria-hidden className="mt-4 h-1.5 overflow-hidden rounded-full bg-site-line">
                <div
                  className="v-gradient-btn h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.min(100, progression)}%` }}
                />
              </div>
            )}
            {detail && (
              <p className={cn("text-xs text-site-muted", progression !== undefined ? "mt-2.5" : "mt-4")}>{detail}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ---- Tableau de bord --------------------------------------------------------

export function TableauDeBord() {
  const { profil } = useEspace();
  const peut = (permission: string) => profil.permissions.includes(permission);
  const moduleActif = (code: string) => profil.modules_actifs.includes(code);

  const voirUtilisateurs = peut("utilisateurs.gerer");
  const voirDepartements = peut("utilisateurs.departements");
  const voirRoles = peut("roles.gerer");
  const voirModules = peut("personnalisation.modules");
  const voirEvenements =
    moduleActif("calendrier") &&
    moduleActif("evenements") &&
    peut("calendrier.consulter") &&
    peut("evenements.consulter");

  // Types que ce rôle peut publier (brouillons) / consulter (publications), module actif
  const typesPublies = useMemo(
    () =>
      TYPES_CONTENU.filter(
        (t) => profil.modules_actifs.includes(t.module) && profil.permissions.includes(`${t.module}.publier`),
      ),
    [profil],
  );
  const typesLisibles = useMemo(
    () =>
      TYPES_CONTENU.filter(
        (t) => profil.modules_actifs.includes(t.module) && profil.permissions.includes(`${t.module}.consulter`),
      ),
    [profil],
  );
  const voirBrouillons = typesPublies.length > 0;
  const voirPublications = typesLisibles.length > 0;

  const chargerUtilisateurs = useCallback(async (token: string) => {
    // Les listes sont paginées : le total suffit, on ne lit pas les lignes
    const [actifs, inactifs] = await Promise.all([
      api<PageTotal>("/utilisateurs?statut=actif", { token }),
      api<PageTotal>("/utilisateurs?statut=inactif", { token }),
    ]);
    return { actifs: actifs.total, inactifs: inactifs.total };
  }, []);

  const chargerDepartements = useCallback((token: string) => api<DepartementResume[]>("/departements", { token }), []);
  const chargerModules = useCallback((token: string) => api<ModuleEtat[]>("/modules", { token }), []);
  const chargerRoles = useCallback((token: string) => api<RoleResume[]>("/roles", { token }), []);

  const chargerBrouillons = useCallback(
    async (token: string) => {
      const reponses = await Promise.allSettled(
        typesPublies.map((t) => api<PageTotal>(`/contenus/${t.type}?statut=brouillon`, { token })),
      );
      if (reponses.every((r) => r.status === "rejected")) throw new Error("brouillons indisponibles");
      // Un type qui échoue est écarté plutôt que compté à 0
      return typesPublies.flatMap((t, i) => {
        const r = reponses[i];
        return r.status === "fulfilled" ? [{ libelle: t.libelle, total: r.value.total }] : [];
      });
    },
    [typesPublies],
  );

  const chargerPublications = useCallback(
    async (token: string) => {
      const reponses = await Promise.allSettled(
        typesLisibles.map((t) => api<PageContenus>(`/contenus/${t.type}?statut=publie`, { token })),
      );
      if (reponses.every((r) => r.status === "rejected")) throw new Error("publications indisponibles");

      const maintenant = new Date();
      const options = { weekStartsOn: 1 as const };
      const semaines = Array.from({ length: NB_SEMAINES }, (_, i) => {
        const debut = startOfWeek(subWeeks(maintenant, NB_SEMAINES - 1 - i), options);
        return { debut, valeur: 0 };
      });

      const recents: { id: string; type: string; titre: string; auteur: string | null; date: Date }[] = [];
      let partiel = false;

      reponses.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const page = r.value;
        let plusAncien: Date | null = null;
        for (const c of page.data) {
          if (!c.date_publication) continue;
          const date = new Date(c.date_publication);
          if (Number.isNaN(date.getTime())) continue;
          if (!plusAncien || date < plusAncien) plusAncien = date;
          const ecart = differenceInCalendarWeeks(maintenant, date, options);
          if (ecart >= 0 && ecart < NB_SEMAINES) semaines[NB_SEMAINES - 1 - ecart].valeur += 1;
          recents.push({
            id: `${typesLisibles[i].type}-${c.id}`,
            type: typesLisibles[i].libelle,
            titre: c.titre,
            auteur: c.auteur ? `${c.auteur.prenom} ${c.auteur.nom}` : null,
            date,
          });
        }
        // La liste est limitée à 20 par type : si le plus ancien reçu est encore dans la
        // fenêtre affichée, des publications plus anciennes de la fenêtre peuvent manquer.
        if (
          page.total > page.data.length &&
          plusAncien &&
          differenceInCalendarWeeks(maintenant, plusAncien, options) < NB_SEMAINES
        ) {
          partiel = true;
        }
      });

      recents.sort((a, b) => b.date.getTime() - a.date.getTime());
      return {
        semaines: semaines.map((s) => ({
          label: format(s.debut, "d MMM", { locale: fr }),
          valeur: s.valeur,
          infobulle: `Semaine du ${format(s.debut, "d MMMM", { locale: fr })} : ${s.valeur} ${pluriel(s.valeur, "publication", "publications")}`,
        })),
        recents: recents.slice(0, 6),
        partiel,
      };
    },
    [typesLisibles],
  );

  const chargerEvenements = useCallback(async (token: string) => {
    const maintenant = new Date();
    const debut = format(maintenant, "yyyy-MM-dd");
    const fin = format(addDays(maintenant, HORIZON_EVENEMENTS_JOURS), "yyyy-MM-dd");
    const r = await api<{ evenements: EvenementApi[] }>(`/evenements?debut=${debut}&fin=${fin}`, { token });
    return r.evenements
      .map((e) => ({
        id: e.id,
        titre: e.titre_evenement,
        lieu: e.lieu,
        debut: dateLocale(e.date_debut),
        fin: dateLocale(e.date_fin),
      }))
      .filter((e) => e.fin >= maintenant)
      .sort((a, b) => a.debut.getTime() - b.debut.getTime());
  }, []);

  const utilisateurs = useDonnees(voirUtilisateurs, chargerUtilisateurs);
  const departements = useDonnees(voirDepartements, chargerDepartements);
  const modules = useDonnees(voirModules, chargerModules);
  const roles = useDonnees(voirRoles, chargerRoles);
  const brouillons = useDonnees(voirBrouillons, chargerBrouillons);
  const publications = useDonnees(voirPublications, chargerPublications);
  const evenements = useDonnees(voirEvenements, chargerEvenements);

  const aujourdhui = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  const nbModulesActifs = modules.donnees?.filter((m) => m.actif).length ?? 0;
  const nbModules = modules.donnees?.length ?? 0;
  const nbObligatoires = modules.donnees?.filter((m) => m.module_obligatoire).length ?? 0;
  const nbEmployesRattaches = departements.donnees?.reduce((somme, d) => somme + d.nb_employes, 0) ?? 0;
  const totalBrouillons = brouillons.donnees?.reduce((somme, b) => somme + b.total, 0) ?? 0;
  const totalComptes = (utilisateurs.donnees?.actifs ?? 0) + (utilisateurs.donnees?.inactifs ?? 0);
  const totalPublications = publications.donnees?.semaines.reduce((s, x) => s + x.valeur, 0) ?? 0;
  const totalRoles = roles.donnees?.reduce((s, r) => s + r.nb_utilisateurs, 0) ?? 0;

  const departementsTries = [...(departements.donnees ?? [])].sort((a, b) => b.nb_employes - a.nb_employes).slice(0, 6);
  const modulesTries = [...(modules.donnees ?? [])].sort(
    (a, b) => Number(b.actif) - Number(a.actif) || a.nom_module.localeCompare(b.nom_module, "fr"),
  );
  const rolesPresents = [...(roles.donnees ?? [])].sort((a, b) => b.nb_utilisateurs - a.nb_utilisateurs);
  const typesAffiches = [...new Set((publications.donnees?.recents ?? []).map((c) => c.type))];
  const couleurType = (type: string) => COULEURS_SERIE[Math.max(0, typesAffiches.indexOf(type)) % 3];

  const rienAAfficher =
    !voirUtilisateurs &&
    !voirDepartements &&
    !voirModules &&
    !voirBrouillons &&
    !voirPublications &&
    !voirRoles &&
    !voirEvenements;

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
            Voici l&apos;état de l&apos;intranet de{" "}
            <span className="font-medium text-site-ink">{profil.entreprise}</span>.
          </p>
        </div>
        <p className="relative inline-flex items-center gap-2 rounded-full border border-site-line bg-site-base/60 px-4 py-2 text-xs text-site-muted first-letter:uppercase">
          <CalendarDays size={14} aria-hidden className="text-brand-violet" />
          {aujourdhui}
        </p>
      </header>

      {rienAAfficher && (
        <Carte>
          <p className="text-sm text-site-muted">
            Votre rôle ne comporte pas d&apos;outil d&apos;administration pour le moment.
          </p>
        </Carte>
      )}

      {/* Indicateurs clés */}
      {(voirUtilisateurs || voirDepartements || voirModules || voirBrouillons) && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {voirUtilisateurs && (
            <Kpi
              icone={Users}
              accent="violet"
              libelle="Comptes actifs"
              valeur={utilisateurs.donnees ? nombre.format(utilisateurs.donnees.actifs) : null}
              progression={totalComptes > 0 ? ((utilisateurs.donnees?.actifs ?? 0) / totalComptes) * 100 : 0}
              detail={
                utilisateurs.donnees
                  ? utilisateurs.donnees.inactifs === 0
                    ? "Aucun compte désactivé"
                    : `${nombre.format(utilisateurs.donnees.inactifs)} ${pluriel(utilisateurs.donnees.inactifs, "compte désactivé", "comptes désactivés")}`
                  : undefined
              }
              chargement={utilisateurs.chargement}
              erreur={utilisateurs.erreur}
              onReessayer={utilisateurs.reessayer}
            />
          )}
          {voirDepartements && (
            <Kpi
              icone={Building2}
              accent="blue"
              libelle="Départements"
              valeur={departements.donnees ? nombre.format(departements.donnees.length) : null}
              detail={
                departements.donnees
                  ? `${nombre.format(nbEmployesRattaches)} ${pluriel(nbEmployesRattaches, "employé rattaché", "employés rattachés")}`
                  : undefined
              }
              chargement={departements.chargement}
              erreur={departements.erreur}
              onReessayer={departements.reessayer}
            />
          )}
          {voirModules && (
            <Kpi
              icone={Blocks}
              accent="cyan"
              libelle="Modules actifs"
              valeur={modules.donnees ? `${nbModulesActifs} / ${nbModules}` : null}
              progression={nbModules > 0 ? (nbModulesActifs / nbModules) * 100 : 0}
              detail={modules.donnees ? `dont ${nbObligatoires} obligatoires` : undefined}
              chargement={modules.chargement}
              erreur={modules.erreur}
              onReessayer={modules.reessayer}
            />
          )}
          {voirBrouillons && (
            <Kpi
              icone={FileClock}
              accent="violet"
              libelle="Brouillons à publier"
              valeur={brouillons.donnees ? nombre.format(totalBrouillons) : null}
              detail={
                brouillons.donnees
                  ? totalBrouillons === 0
                    ? "Rien en attente"
                    : `réparti sur ${brouillons.donnees.length} ${pluriel(brouillons.donnees.length, "type de contenu", "types de contenu")}`
                  : undefined
              }
              chargement={brouillons.chargement}
              erreur={brouillons.erreur}
              onReessayer={brouillons.reessayer}
            />
          )}
        </div>
      )}

      {/* Publications dans le temps + comptes par rôle */}
      {(voirPublications || voirRoles) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {voirPublications && (
            <Carte className={voirRoles ? "lg:col-span-2" : "lg:col-span-3"}>
              <EnteteCarte
                icone={TrendingUp}
                titre="Publications"
                meta={
                  publications.donnees
                    ? `${NB_SEMAINES} semaines · ${totalPublications} au total`
                    : `${NB_SEMAINES} semaines`
                }
              />
              {publications.chargement ? (
                <Squelette className="h-60 w-full" />
              ) : publications.erreur || !publications.donnees ? (
                <ErreurBloc onReessayer={publications.reessayer} />
              ) : (
                <>
                  <CourbeAire
                    donnees={publications.donnees.semaines}
                    description={`Publications par semaine sur ${NB_SEMAINES} semaines, ${totalPublications} au total.`}
                  />
                  {publications.donnees.partiel && (
                    <p className="mt-4 text-xs text-site-muted">
                      Aperçu partiel : seuls les 20 derniers contenus de chaque type sont comptés.
                    </p>
                  )}
                </>
              )}
            </Carte>
          )}

          {voirRoles && (
            <Carte className={voirPublications ? undefined : "lg:col-span-3"}>
              <EnteteCarte icone={PieChart} titre="Comptes par rôle" />
              {roles.chargement ? (
                <Squelette className="mx-auto size-48 rounded-full" />
              ) : roles.erreur || !roles.donnees ? (
                <ErreurBloc onReessayer={roles.reessayer} />
              ) : totalRoles === 0 ? (
                <Vide>Aucun compte pour le moment.</Vide>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <Anneau
                    segments={rolesPresents.map((r, i) => ({
                      label: r.nom_role,
                      valeur: r.nb_utilisateurs,
                      couleur: COULEURS_SERIE[i % COULEURS_SERIE.length],
                    }))}
                    centreValeur={nombre.format(totalRoles)}
                    centreLibelle={pluriel(totalRoles, "compte", "comptes")}
                    description={`Répartition de ${totalRoles} comptes par rôle.`}
                  />
                  <ul className="w-full space-y-2.5 text-sm">
                    {rolesPresents.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: COULEURS_SERIE[i % COULEURS_SERIE.length] }}
                        />
                        <span className="truncate">{r.nom_role}</span>
                        <span className="ml-auto shrink-0 tabular-nums">
                          <span className="font-semibold">{nombre.format(r.nb_utilisateurs)}</span>
                          <span className="ml-2 inline-block w-9 text-right text-xs text-site-muted">
                            {Math.round((r.nb_utilisateurs / totalRoles) * 100)} %
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Carte>
          )}
        </div>
      )}

      {/* Départements + événements à venir */}
      {(voirDepartements || voirEvenements) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {voirDepartements && (
            <Carte className={voirEvenements ? "lg:col-span-2" : "lg:col-span-3"}>
              <EnteteCarte
                icone={Building2}
                titre="Employés par département"
                meta={
                  (departements.donnees?.length ?? 0) > departementsTries.length
                    ? `Top ${departementsTries.length} sur ${departements.donnees?.length}`
                    : undefined
                }
              />
              {departements.chargement ? (
                <div className="space-y-5">
                  <Squelette className="h-9 w-full" />
                  <Squelette className="h-9 w-full" />
                  <Squelette className="h-9 w-full" />
                </div>
              ) : departements.erreur ? (
                <ErreurBloc onReessayer={departements.reessayer} />
              ) : departementsTries.length === 0 ? (
                <Vide>Aucun département n&apos;a encore été créé.</Vide>
              ) : (
                <ListeBarres
                  formatValeur={(n) => nombre.format(n)}
                  lignes={departementsTries.map((d) => ({
                    id: d.id,
                    label: d.nom_departement,
                    valeur: d.nb_employes,
                    sousTitre: d.responsable
                      ? `Responsable : ${d.responsable.prenom} ${d.responsable.nom}`
                      : "Aucun responsable désigné",
                  }))}
                />
              )}
            </Carte>
          )}

          {voirEvenements && (
            <Carte className={voirDepartements ? undefined : "lg:col-span-3"}>
              <EnteteCarte
                icone={CalendarDays}
                titre="Prochains événements"
                meta={`${HORIZON_EVENEMENTS_JOURS} jours`}
              />
              {evenements.chargement ? (
                <div className="space-y-4">
                  <Squelette className="h-12 w-full" />
                  <Squelette className="h-12 w-full" />
                  <Squelette className="h-12 w-full" />
                </div>
              ) : evenements.erreur || !evenements.donnees ? (
                <ErreurBloc onReessayer={evenements.reessayer} />
              ) : evenements.donnees.length === 0 ? (
                <Vide>
                  <CalendarDays size={22} className="mx-auto mb-2 opacity-60" aria-hidden />
                  Aucun événement prévu.
                </Vide>
              ) : (
                <ul className="space-y-3">
                  {evenements.donnees.slice(0, 5).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-site-line hover:bg-site-base/40"
                    >
                      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-violet/15 leading-none text-brand-violet">
                        <span className="font-display text-lg font-bold">{format(e.debut, "d")}</span>
                        <span className="mt-0.5 text-[10px] font-semibold uppercase">
                          {format(e.debut, "MMM", { locale: fr })}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.titre}</p>
                        <p className="truncate text-xs text-site-muted">
                          {isSameDay(e.debut, e.fin)
                            ? `${format(e.debut, "HH:mm")} – ${format(e.fin, "HH:mm")}`
                            : `jusqu'au ${format(e.fin, "d MMM", { locale: fr })}`}
                          {e.lieu ? ` · ${e.lieu}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  {evenements.donnees.length > 5 && (
                    <li className="px-2 text-xs text-site-muted">
                      + {evenements.donnees.length - 5} autre(s) dans les {HORIZON_EVENEMENTS_JOURS} prochains jours
                    </li>
                  )}
                </ul>
              )}
            </Carte>
          )}
        </div>
      )}

      {/* Dernières publications + brouillons */}
      {(voirPublications || voirBrouillons) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {voirPublications && (
            <Carte className={voirBrouillons ? "lg:col-span-2" : "lg:col-span-3"}>
              <EnteteCarte icone={Newspaper} titre="Dernières publications" />
              {publications.chargement ? (
                <div className="space-y-4">
                  <Squelette className="h-10 w-full" />
                  <Squelette className="h-10 w-full" />
                  <Squelette className="h-10 w-full" />
                </div>
              ) : publications.erreur || !publications.donnees ? (
                <ErreurBloc onReessayer={publications.reessayer} />
              ) : publications.donnees.recents.length === 0 ? (
                <Vide>Aucun contenu publié pour le moment.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {publications.donnees.recents.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                      <span
                        className="w-28 shrink-0 truncate rounded-full px-2.5 py-1 text-center text-[11px] font-semibold"
                        style={{
                          color: couleurType(c.type),
                          background: `color-mix(in oklab, ${couleurType(c.type)} 15%, transparent)`,
                        }}
                      >
                        {c.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.titre}</p>
                        {c.auteur && <p className="truncate text-xs text-site-muted">{c.auteur}</p>}
                      </div>
                      <time dateTime={c.date.toISOString()} className="shrink-0 text-xs text-site-muted">
                        {formatDistanceToNow(c.date, { locale: fr, addSuffix: true })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          )}

          {voirBrouillons && (
            <Carte className={voirPublications ? undefined : "lg:col-span-3"}>
              <EnteteCarte icone={FileClock} titre="Brouillons par type" />
              {brouillons.chargement ? (
                <div className="space-y-5">
                  <Squelette className="h-9 w-full" />
                  <Squelette className="h-9 w-full" />
                </div>
              ) : brouillons.erreur || !brouillons.donnees ? (
                <ErreurBloc onReessayer={brouillons.reessayer} />
              ) : totalBrouillons === 0 ? (
                <Vide>Aucun brouillon en attente de publication.</Vide>
              ) : (
                <ListeBarres
                  formatValeur={(n) => nombre.format(n)}
                  lignes={brouillons.donnees.map((b) => ({ id: b.libelle, label: b.libelle, valeur: b.total }))}
                />
              )}
            </Carte>
          )}
        </div>
      )}

      {/* Modules */}
      {voirModules && (
        <Carte>
          <EnteteCarte
            icone={Blocks}
            titre="Modules de l'intranet"
            meta={modules.donnees ? `${nbModulesActifs} sur ${nbModules} activés` : undefined}
          />
          {modules.chargement ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Squelette key={i} className="h-16" />
              ))}
            </div>
          ) : modules.erreur ? (
            <ErreurBloc onReessayer={modules.reessayer} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modulesTries.map((m) => {
                const Icone = iconeModule(m.code_module);
                return (
                  <li
                    key={m.code_module}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-site-line bg-site-base/40 p-3.5 transition-colors hover:border-brand-violet/40",
                      !m.actif && "opacity-55",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                      <Icone size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.nom_module}</p>
                      <p className="truncate text-xs text-site-muted">
                        {m.module_obligatoire ? "Obligatoire" : m.actif ? "Activé" : "Désactivé"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        m.actif ? "bg-brand-cyan/15 text-brand-cyan" : "bg-site-line text-site-muted",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", m.actif ? "bg-brand-cyan" : "bg-site-muted")}
                      />
                      {m.actif ? "Actif" : "Inactif"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      )}
    </div>
  );
}

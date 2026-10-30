"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  ClipboardList,
  Cake,
  Download,
  FileText,
  FolderOpen,
  Newspaper,
  RefreshCw,
  ScrollText,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, messageErreur, telechargerFichier, urlStockage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { ICONES_TYPE, LecteurContenu, type Ouvert, type TypeContenu } from "./lecteur-contenu";
import { useDonnees } from "./use-donnees";


type Auteur = { id: number; nom: string; prenom: string } | null;
type Personne = { id: number; nom: string; prenom: string; poste: string | null; photo: string | null };

type Donnees = {
  genere_le: string;
  profil: { date_embauche: string | null; anciennete_mois: number | null; fiche_manque: string[] };
  equipe: {
    departement: {
      id: number;
      nom_departement: string;
      description: string | null;
      nb_employes: number;
      responsable: { id: number; nom: string; prenom: string; poste: string | null } | null;
    } | null;
    superieur: Personne | null;
    nb_collegues: number;
    collegues: Personne[];
    anniversaires: { id: number; nom: string; prenom: string; poste: string | null; date: string; annees: number }[];
    nouveaux: (Personne & { date_embauche: string })[];
  };
  contenus: {
    types: { type: TypeContenu; libelle: string; total: number; nouveaux: number }[];
    fil: {
      type: TypeContenu;
      libelle_type: string;
      id: number;
      titre: string;
      extrait: string;
      categorie: string | null;
      numero_note: string | null;
      date_publication: string | null;
      auteur: Auteur;
      nouveau: boolean;
    }[];
    notes: {
      total: number;
      lues: number;
      a_lire: number;
      taux_lecture: number;
      liste: {
        id: number;
        titre: string;
        numero_note: string | null;
        date_publication: string | null;
        auteur: Auteur;
      }[];
    } | null;
  };
  evenements: {
    total: number;
    aujourdhui: number;
    a_venir: { id: number; titre_evenement: string; lieu: string | null; date_debut: string; date_fin: string }[];
  } | null;
  formulaires: {
    a_remplir: number;
    liste: { id: number; titre_formulaire: string; date_limite: string | null }[];
  } | null;
  documents: {
    total: number;
    recents: {
      id: number;
      nom_document: string;
      categorie: string | null;
      type_mime: string | null;
      taille_fichier: number | null;
      created_at: string | null;
    }[];
  } | null;
};

const nombre = new Intl.NumberFormat("fr-FR");
const pluriel = (n: number, singulier: string, plur: string) => (n > 1 ? plur : singulier);
const nomComplet = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`;
const initialesDe = (p: { prenom: string; nom: string }) => `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase();
const dateLocale = (s: string) => parseISO(s.replace(" ", "T"));

const depuis = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }) : "");

function taille(octets: number | null) {
  if (!octets) return null;
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

function anciennete(mois: number | null) {
  if (mois === null) return null;
  if (mois < 1) return "Moins d'un mois";
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const morceaux = [ans > 0 ? `${ans} ${pluriel(ans, "an", "ans")}` : null, reste > 0 ? `${reste} mois` : null].filter(
    Boolean,
  );
  return morceaux.join(" et ");
}

const LIBELLES_MANQUE: Record<string, string> = {
  poste: "votre poste",
  telephone: "votre téléphone",
  photo: "votre photo",
};

const BOUTON_PETIT =
  "inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50";


type Accent = "violet" | "blue" | "cyan";

const ACCENTS: Record<Accent, { tuile: string; halo: string }> = {
  violet: { tuile: "bg-brand-violet/15 text-brand-violet", halo: "bg-brand-violet/20" },
  blue: { tuile: "bg-brand-blue/15 text-brand-blue", halo: "bg-brand-blue/20" },
  cyan: { tuile: "bg-brand-cyan/15 text-brand-cyan", halo: "bg-brand-cyan/20" },
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
    <div className="mb-5 flex items-center gap-3">
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

function Vide({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-site-muted">{children}</p>;
}

function Avatar({
  personne,
  taille: t = "size-9",
}: {
  personne: { prenom: string; nom: string; photo?: string | null };
  taille?: string;
}) {
  return personne.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={urlStockage(personne.photo)} alt="" className={cn("shrink-0 rounded-full object-cover", t)} />
  ) : (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-xs font-semibold text-brand-violet",
        t,
      )}
    >
      {initialesDe(personne)}
    </span>
  );
}

function Kpi({
  icone: Icone,
  accent,
  libelle,
  valeur,
  detail,
  progression,
}: {
  icone: LucideIcon;
  accent: Accent;
  libelle: string;
  valeur: string;
  detail?: string;
  progression?: number;
}) {
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
      </div>
    </section>
  );
}

// ---- Tableau de bord ---------------------------------------------------------------

export function EmployeTableauDeBord() {
  const { profil, token } = useEspace();
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const [telechargement, setTelechargement] = useState<number | null>(null);
  const [erreurDoc, setErreurDoc] = useState<string | null>(null);

  const charger = useCallback((jeton: string) => api<Donnees>("/employe/tableau-de-bord", { token: jeton }), []);
  const { donnees: d, chargement, erreur, reessayer } = useDonnees(true, charger);
  const fermer = useCallback(() => setOuvert(null), []);

  async function telecharger(id: number) {
    setTelechargement(id);
    setErreurDoc(null);
    try {
      await telechargerFichier(`/documents/${id}/lien`, token);
    } catch (err) {
      setErreurDoc(messageErreur(err));
    } finally {
      setTelechargement(null);
    }
  }

  const aujourdhui = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const maintenant = new Date();

  if (!d) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Bonjour {profil.prenom}</h1>
          <p className="mt-1 text-sm capitalize text-site-muted">{aujourdhui}</p>
        </div>
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Carte key={i}>
                <Squelette className="h-10 w-24" />
                <Squelette className="mt-4 h-3.5 w-32" />
              </Carte>
            ))}
          </div>
        )}
        {chargement && !erreur && <span className="sr-only">Chargement…</span>}
      </div>
    );
  }

  const { contenus: ct, equipe, evenements, formulaires, documents } = d;
  const notes = ct.notes;
  const nbNouveautes = ct.types.reduce((s, t) => s + t.nouveaux, 0);
  const evenementsAffiches = evenements?.a_venir.slice(0, 5) ?? [];
  const echeance = (iso: string | null) => (iso ? parseISO(iso) : null);

  const kpis: ReactNode[] = [];
  if (notes) {
    kpis.push(
      <Kpi
        key="notes"
        icone={ScrollText}
        accent="violet"
        libelle="Notes à lire"
        valeur={nombre.format(notes.a_lire)}
        progression={notes.taux_lecture}
        detail={
          notes.total > 0
            ? `${notes.lues} lue${notes.lues > 1 ? "s" : ""} sur ${notes.total} ces 90 derniers jours`
            : "Aucune note ces 90 derniers jours"
        }
      />,
    );
  }
  if (ct.types.length > 0) {
    kpis.push(
      <Kpi
        key="nouveautes"
        icone={Sparkles}
        accent="blue"
        libelle="Nouveautés (7 jours)"
        valeur={nombre.format(nbNouveautes)}
        detail={
          nbNouveautes > 0
            ? ct.types
                .filter((t) => t.nouveaux > 0)
                .map((t) => `${t.nouveaux} ${t.libelle.toLowerCase()}`)
                .join(" · ")
            : "Rien de nouveau cette semaine"
        }
      />,
    );
  }
  if (evenements) {
    kpis.push(
      <Kpi
        key="evenements"
        icone={CalendarDays}
        accent="cyan"
        libelle="Événements à venir"
        valeur={nombre.format(evenements.total)}
        detail={evenements.aujourdhui > 0 ? `${evenements.aujourdhui} aujourd'hui` : "Dans les 30 prochains jours"}
      />,
    );
  }
  if (formulaires) {
    kpis.push(
      <Kpi
        key="formulaires"
        icone={ClipboardList}
        accent="violet"
        libelle="Formulaires à remplir"
        valeur={nombre.format(formulaires.a_remplir)}
        detail={formulaires.a_remplir > 0 ? "En attente de votre réponse" : "Vous êtes à jour"}
      />,
    );
  }

  const ancienneteTexte = anciennete(d.profil.anciennete_mois);
  const manque = d.profil.fiche_manque.map((m) => LIBELLES_MANQUE[m] ?? m);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Bonjour {profil.prenom}</h1>
          <p className="mt-1 text-sm text-site-muted">
            <span className="capitalize">{aujourdhui}</span>
            {equipe.departement ? ` · ${equipe.departement.nom_departement}` : ""}
            {ancienneteTexte ? ` · Ancienneté : ${ancienneteTexte}` : ""}
          </p>
        </div>
        <button type="button" onClick={reessayer} disabled={chargement} className={BOUTON_PETIT}>
          <RefreshCw size={13} aria-hidden className={cn(chargement && "animate-spin")} /> Actualiser
        </button>
      </div>

      {manque.length > 0 && (
        <p className="rounded-xl border border-dashed border-site-line px-4 py-3 text-sm text-site-muted">
          Votre fiche est incomplète : ajoutez {manque.join(", ")} depuis votre profil pour que vos collègues puissent
          vous retrouver.
        </p>
      )}

      {/* Indicateurs */}
      {kpis.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Notes de service à lire */}
          {notes && (
            <Carte>
              <EnteteCarte
                icone={ScrollText}
                titre="À lire en priorité"
                meta={notes.a_lire > 0 ? `${notes.a_lire} ${pluriel(notes.a_lire, "note", "notes")}` : undefined}
              />
              {notes.liste.length === 0 ? (
                <Vide>Vous avez lu toutes vos notes de service.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {notes.liste.map((n) => (
                    <li key={n.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{n.titre}</p>
                        <p className="truncate text-xs text-site-muted">
                          {[
                            n.numero_note ? `N° ${n.numero_note}` : null,
                            n.auteur ? nomComplet(n.auteur) : null,
                            depuis(n.date_publication),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={BOUTON_PETIT}
                        onClick={() => setOuvert({ type: "note_service", id: n.id, titre: n.titre })}
                      >
                        Lire
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {notes.a_lire > notes.liste.length && (
                <p className="mt-4 text-xs text-site-muted">
                  Et {notes.a_lire - notes.liste.length} {pluriel(notes.a_lire - notes.liste.length, "autre", "autres")}{" "}
                  après celles-ci.
                </p>
              )}
            </Carte>
          )}

          {/* Fil des publications */}
          {ct.types.length > 0 && (
            <Carte>
              <EnteteCarte
                icone={Newspaper}
                titre="Dernières publications"
                meta={ct.types.map((t) => t.libelle).join(" · ")}
              />
              {ct.fil.length === 0 ? (
                <Vide>Aucune publication pour le moment.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {ct.fil.map((c) => {
                    const Icone = ICONES_TYPE[c.type];
                    return (
                      <li key={`${c.type}-${c.id}`}>
                        <button
                          type="button"
                          onClick={() => setOuvert({ type: c.type, id: c.id, titre: c.titre })}
                          className="flex w-full items-start gap-3 py-3 text-left transition-colors first:pt-0 last:pb-0 hover:text-brand-violet"
                        >
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-violet/12 text-brand-violet">
                            <Icone size={15} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{c.titre}</span>
                              {c.nouveau && (
                                <span className="shrink-0 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-cyan">
                                  Nouveau
                                </span>
                              )}
                            </span>
                            {c.extrait && (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-site-muted">{c.extrait}</span>
                            )}
                            <span className="mt-1 block truncate text-[11px] text-site-muted">
                              {[c.libelle_type, c.auteur ? nomComplet(c.auteur) : null, depuis(c.date_publication)]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>
          )}

          {/* Documents */}
          {documents && (
            <Carte>
              <EnteteCarte
                icone={FolderOpen}
                titre="Documents récents"
                meta={`${nombre.format(documents.total)} ${pluriel(documents.total, "document", "documents")}`}
              />
              {documents.recents.length === 0 ? (
                <Vide>Aucun document partagé pour le moment.</Vide>
              ) : (
                <ul className="divide-y divide-site-line">
                  {documents.recents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue">
                        <FileText size={15} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.nom_document}</p>
                        <p className="truncate text-xs text-site-muted">
                          {[doc.categorie, taille(doc.taille_fichier), depuis(doc.created_at)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={BOUTON_PETIT}
                        disabled={telechargement === doc.id}
                        onClick={() => telecharger(doc.id)}
                        aria-label={`Télécharger ${doc.nom_document}`}
                      >
                        <Download size={13} aria-hidden /> {telechargement === doc.id ? "…" : "Télécharger"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {erreurDoc && (
                <p role="alert" className="mt-3 text-xs text-site-danger">
                  {erreurDoc}
                </p>
              )}
            </Carte>
          )}
        </div>

        <div className="space-y-6">
          {/* Événements */}
          {evenements && (
            <Carte>
              <EnteteCarte icone={CalendarDays} titre="Prochains événements" meta="30 jours" />
              {evenementsAffiches.length === 0 ? (
                <Vide>Aucun événement prévu.</Vide>
              ) : (
                <ul className="space-y-3">
                  {evenementsAffiches.map((e) => {
                    const debut = dateLocale(e.date_debut);
                    const fin = dateLocale(e.date_fin);
                    const enCours = debut <= maintenant && fin >= maintenant;
                    return (
                      <li key={e.id} className="flex items-start gap-3">
                        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-brand-violet/12 py-1 text-brand-violet">
                          <span className="text-[10px] font-semibold uppercase">
                            {format(debut, "MMM", { locale: fr })}
                          </span>
                          <span className="text-base font-bold leading-none tabular-nums">{format(debut, "d")}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.titre_evenement}</p>
                          <p className="truncate text-xs text-site-muted">
                            {[
                              enCours
                                ? "En cours"
                                : isSameDay(debut, maintenant)
                                  ? `Aujourd'hui à ${format(debut, "HH:mm")}`
                                  : format(debut, "EEEE à HH:mm", { locale: fr }),
                              e.lieu,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>
          )}

          {/* Formulaires */}
          {formulaires && (
            <Carte>
              <EnteteCarte
                icone={ClipboardList}
                titre="Formulaires à remplir"
                meta={formulaires.a_remplir > 0 ? String(formulaires.a_remplir) : undefined}
              />
              {formulaires.liste.length === 0 ? (
                <Vide>Aucun formulaire en attente.</Vide>
              ) : (
                <ul className="space-y-3">
                  {formulaires.liste.map((f) => {
                    const limite = echeance(f.date_limite);
                    const urgent = limite !== null && limite.getTime() - maintenant.getTime() < 3 * 86_400_000;
                    return (
                      <li key={f.id}>
                        <Link
                          href="/espace/mes-formulaires"
                          className="flex items-center gap-3 rounded-lg transition-colors hover:text-brand-violet"
                        >
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">{f.titre_formulaire}</p>
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              urgent ? "font-semibold text-site-danger" : "text-site-muted",
                            )}
                          >
                            {limite ? `Avant le ${format(limite, "d MMM", { locale: fr })}` : "Sans date limite"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>
          )}

          {/* Mon équipe */}
          <Carte>
            <EnteteCarte
              icone={Users}
              titre="Mon équipe"
              meta={equipe.departement ? equipe.departement.nom_departement : undefined}
            />
            {!equipe.departement && !equipe.superieur ? (
              <Vide>Vous n&apos;êtes pas encore rattaché(e) à un département. Contactez les ressources humaines.</Vide>
            ) : (
              <div className="space-y-4">
                {equipe.superieur && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-site-muted">
                      Mon supérieur
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar personne={equipe.superieur} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{nomComplet(equipe.superieur)}</p>
                        {equipe.superieur.poste && (
                          <p className="truncate text-xs text-site-muted">{equipe.superieur.poste}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {equipe.departement?.responsable && equipe.departement.responsable.id !== equipe.superieur?.id && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-site-muted">
                      Responsable du département
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar personne={{ ...equipe.departement.responsable, photo: null }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{nomComplet(equipe.departement.responsable)}</p>
                        {equipe.departement.responsable.poste && (
                          <p className="truncate text-xs text-site-muted">{equipe.departement.responsable.poste}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {equipe.collegues.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-site-muted">
                      Collègues ({equipe.nb_collegues})
                    </p>
                    <ul className="space-y-2.5">
                      {equipe.collegues.map((c) => (
                        <li key={c.id} className="flex items-center gap-3">
                          <Avatar personne={c} taille="size-8" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{nomComplet(c)}</p>
                            {c.poste && <p className="truncate text-xs text-site-muted">{c.poste}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {equipe.nb_collegues > equipe.collegues.length && (
                      <p className="mt-2 text-xs text-site-muted">
                        et {equipe.nb_collegues - equipe.collegues.length}{" "}
                        {pluriel(equipe.nb_collegues - equipe.collegues.length, "autre", "autres")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Carte>

          {/* Anniversaires et arrivées */}
          {(equipe.anniversaires.length > 0 || equipe.nouveaux.length > 0) && (
            <Carte>
              <EnteteCarte icone={Cake} titre="Vie de l'équipe" meta="30 jours" />
              <ul className="space-y-3">
                {equipe.anniversaires.map((a) => (
                  <li key={`a-${a.id}`} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/15 text-brand-cyan">
                      <Cake size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nomComplet(a)}</p>
                      <p className="truncate text-xs text-site-muted">
                        {a.annees} {pluriel(a.annees, "an", "ans")} dans l&apos;entreprise ·{" "}
                        {format(parseISO(a.date), "d MMMM", { locale: fr })}
                      </p>
                    </div>
                  </li>
                ))}
                {equipe.nouveaux.map((n) => (
                  <li key={`n-${n.id}`} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue">
                      <UserPlus size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nomComplet(n)}</p>
                      <p className="truncate text-xs text-site-muted">
                        Nouvel arrivant · {format(parseISO(n.date_embauche), "d MMMM", { locale: fr })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </div>
      </div>

      {ouvert && <LecteurContenu ouvert={ouvert} onFermer={fermer} onLu={reessayer} />}
    </div>
  );
}

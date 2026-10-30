"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNowStrict, isSameYear, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BookCheck, CheckCircle2, Globe, Newspaper, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { api, ApiError, urlStockage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { ICONES_TYPE, LecteurContenu, type ImageContenu, type Ouvert, type TypeContenu } from "./lecteur-contenu";

// Accueil de l'employé : un fil de publications façon réseau social, de la plus récente à la plus
// ancienne (actualités, annonces, articles, notes de service). Les pages se chargent au défilement.

type Post = {
  type: TypeContenu;
  libelle_type: string;
  id: number;
  titre: string;
  categorie: string | null;
  numero_note: string | null;
  extrait: string;
  tronque: boolean;
  date_publication: string | null;
  date_expiration: string | null;
  visibilite: "entreprise" | "departement";
  departement: string | null;
  auteur: { id: number; nom: string; prenom: string; photo: string | null; role: string | null } | null;
  images: ImageContenu[];
  lu: boolean | null;
};

type Reponse = { data: Post[]; current_page: number; last_page: number; total: number };

type Filtre = "tous" | TypeContenu;

const TYPES: { type: TypeContenu; libelle: string; singulier: string; module: string }[] = [
  { type: "actualite", libelle: "Actualités", singulier: "Actualité", module: "actualites" },
  { type: "annonce", libelle: "Annonces", singulier: "Annonce", module: "annonces" },
  { type: "article", libelle: "Articles", singulier: "Article", module: "articles" },
  { type: "note_service", libelle: "Notes de service", singulier: "Note de service", module: "notes_service" },
];

const SINGULIER = Object.fromEntries(TYPES.map((t) => [t.type, t.singulier])) as Record<TypeContenu, string>;

const COULEUR_TYPE: Record<TypeContenu, string> = {
  actualite: "bg-brand-violet/12 text-brand-violet",
  annonce: "bg-brand-cyan/15 text-brand-cyan",
  article: "bg-brand-blue/15 text-brand-blue",
  note_service: "bg-brand-violet/12 text-brand-violet",
};

const LONGUEUR_VISIBLE = 320; // au-delà, « Voir plus » ouvre la lecture complète

const BOUTON_PETIT =
  "inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50";

const nomComplet = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`;
const initialesDe = (p: { prenom: string; nom: string }) => `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase();

// « 3 février, 10:30 », avec l'année si elle n'est pas l'année en cours
function dateAffichee(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return format(d, isSameYear(d, new Date()) ? "d MMMM, HH:mm" : "d MMMM yyyy, HH:mm", { locale: fr });
}

const ilYA = (iso: string | null) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: fr }) : "";

// ---- Éléments d'affichage ----------------------------------------------------------

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Carte({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article className={cn("rounded-2xl border border-site-line bg-site-surface shadow-sm", className)}>
      {children}
    </article>
  );
}

function SqueletteCarte() {
  return (
    <Carte className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Squelette className="size-11 rounded-full" />
        <div className="space-y-2">
          <Squelette className="h-3.5 w-40" />
          <Squelette className="h-3 w-28" />
        </div>
      </div>
      <Squelette className="h-4 w-2/3" />
      <Squelette className="h-3.5 w-full" />
      <Squelette className="h-3.5 w-5/6" />
      <Squelette className="h-56 w-full rounded-xl" />
    </Carte>
  );
}

function Avatar({ auteur }: { auteur: Post["auteur"] }) {
  if (!auteur) {
    return <span aria-hidden className="size-11 shrink-0 rounded-full bg-site-line" />;
  }
  return auteur.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={urlStockage(auteur.photo)} alt="" className="size-11 shrink-0 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-sm font-semibold text-brand-violet"
    >
      {initialesDe(auteur)}
    </span>
  );
}

// Images de la publication : 1 grande, 2 côte à côte, 3 (1 + 2), 4 ou plus (grille 2×2 avec « +N »)
function Galerie({ images, onOuvrir }: { images: ImageContenu[]; onOuvrir: () => void }) {
  const n = images.length;
  if (n === 0) return null;
  const visibles = images.slice(0, 4);
  const reste = n - visibles.length;

  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-xl", n > 1 && "grid-cols-2")}>
      {visibles.map((i, idx) => (
        <button
          key={i.id}
          type="button"
          onClick={onOuvrir}
          aria-label={`Ouvrir la publication : ${i.texte_alternatif ?? i.nom_image}`}
          className={cn(
            "relative block overflow-hidden bg-site-base/50",
            n === 1 && "max-h-[34rem]",
            n === 2 && "aspect-[4/5]",
            n >= 3 && "aspect-video",
            n === 3 && idx === 0 && "col-span-2",
          )}
        >
          {/* Adresse signée temporaire : next/image n'est pas adapté */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={i.url}
            alt={i.texte_alternatif ?? i.nom_image}
            loading="lazy"
            className={cn("w-full object-cover", n === 1 ? "max-h-[34rem]" : "h-full")}
          />
          {reste > 0 && idx === visibles.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-3xl font-bold text-white">
              +{reste}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Publication({ post, lu, onOuvrir }: { post: Post; lu: boolean; onOuvrir: () => void }) {
  const Icone = ICONES_TYPE[post.type];
  const Audience = post.visibilite === "departement" ? Users : Globe;
  const audience = post.visibilite === "departement" ? (post.departement ?? "Mon département") : "Toute l'entreprise";
  const long = post.extrait.length > LONGUEUR_VISIBLE;
  const texte = long ? `${post.extrait.slice(0, LONGUEUR_VISIBLE).trimEnd()}…` : post.extrait;
  const estArticle = post.type === "article";
  const estNote = post.type === "note_service";

  const repere = [
    estNote && post.numero_note ? `Note n° ${post.numero_note}` : null,
    post.categorie,
    post.type === "annonce" && post.date_expiration
      ? `Valable jusqu'au ${format(parseISO(post.date_expiration), "d MMMM", { locale: fr })}`
      : null,
  ].filter(Boolean);

  return (
    <Carte className="p-4 sm:p-5">
      {/* En-tête : auteur, rôle, date, audience */}
      <header className="flex items-start gap-3">
        <Avatar auteur={post.auteur} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15px] font-semibold">
              {post.auteur ? nomComplet(post.auteur) : "Ancien membre"}
            </span>
            {post.auteur?.role && (
              <span className="inline-flex items-center gap-1 rounded-md bg-site-surface2 px-1.5 py-0.5 text-[11px] font-semibold text-site-muted">
                <ShieldCheck size={11} aria-hidden /> {post.auteur.role}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-site-muted">
            <time dateTime={post.date_publication ?? undefined} title={ilYA(post.date_publication)}>
              {dateAffichee(post.date_publication)}
            </time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Audience size={12} aria-hidden /> {audience}
            </span>
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            COULEUR_TYPE[post.type],
          )}
        >
          <Icone size={12} aria-hidden /> {SINGULIER[post.type]}
        </span>
      </header>

      {estArticle ? (
        // Article : carte « lien » avec couverture, titre et résumé
        <button
          type="button"
          onClick={onOuvrir}
          className="mt-4 block w-full overflow-hidden rounded-xl border border-site-line text-left transition-colors hover:border-brand-violet/50"
        >
          {post.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.images[0].url}
              alt={post.images[0].texte_alternatif ?? post.images[0].nom_image}
              loading="lazy"
              className="aspect-[1.91/1] w-full object-cover"
            />
          )}
          <span className="block bg-site-base/40 p-4">
            {repere.length > 0 && (
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-site-muted">
                {repere.join(" · ")}
              </span>
            )}
            <span className="mt-1 block font-display text-lg font-semibold leading-snug">{post.titre}</span>
            {post.extrait && <span className="mt-1 line-clamp-2 block text-sm text-site-muted">{post.extrait}</span>}
            <span className="mt-2 block text-xs font-semibold text-brand-violet">Lire l&apos;article</span>
          </span>
        </button>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {repere.length > 0 && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-site-muted">{repere.join(" · ")}</p>
            )}
            <h3 className="font-display text-[17px] font-semibold leading-snug">{post.titre}</h3>
            {texte && (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                {texte}
                {long && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={onOuvrir}
                      className="font-semibold text-site-muted hover:text-brand-violet hover:underline"
                    >
                      Voir plus
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          {post.images.length > 0 && (
            <div className="mt-3">
              <Galerie images={post.images} onOuvrir={onOuvrir} />
            </div>
          )}
        </>
      )}

      {estNote && (
        <footer className="mt-4 flex items-center justify-between gap-3 border-t border-site-line pt-3">
          {lu ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-brand-cyan">
              <CheckCircle2 size={16} aria-hidden /> Lecture confirmée
            </p>
          ) : (
            <>
              <p className="text-xs text-site-muted">Cette note attend votre confirmation de lecture.</p>
              <button
                type="button"
                onClick={onOuvrir}
                className="v-gradient-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                <BookCheck size={13} aria-hidden /> Lire et confirmer
              </button>
            </>
          )}
        </footer>
      )}
    </Carte>
  );
}

// ---- Flux : première page + pages suivantes au défilement --------------------------

function Flux({ type }: { type: Filtre }) {
  const { token, expirer } = useEspace();
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const [lus, setLus] = useState<Set<string>>(() => new Set());
  const [suite, setSuite] = useState<Post[]>([]);
  const [prochaine, setProchaine] = useState(2);
  const [chargementSuite, setChargementSuite] = useState(false);
  const [erreurSuite, setErreurSuite] = useState(false);
  const sentinelle = useRef<HTMLDivElement>(null);

  const filtreUrl = type === "tous" ? "" : `&type=${type}`;
  const chargerPremiere = useCallback(
    (jeton: string) => api<Reponse>(`/fil?page=1${filtreUrl}`, { token: jeton }),
    [filtreUrl],
  );
  const premiere = useDonnees(true, chargerPremiere);

  const posts = useMemo(() => {
    const tous = [...(premiere.donnees?.data ?? []), ...suite];
    const vus = new Set<string>();
    return tous.filter((p) => {
      const cle = `${p.type}-${p.id}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
  }, [premiere.donnees, suite]);

  const derniere = premiere.donnees?.last_page ?? 1;
  const encore = premiere.donnees !== null && prochaine <= derniere;

  const chargerSuite = useCallback(async () => {
    setChargementSuite(true);
    setErreurSuite(false);
    try {
      const r = await api<Reponse>(`/fil?page=${prochaine}${filtreUrl}`, { token });
      setSuite((anciens) => [...anciens, ...r.data]);
      setProchaine((n) => n + 1);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return;
      }
      setErreurSuite(true);
    } finally {
      setChargementSuite(false);
    }
  }, [prochaine, filtreUrl, token, expirer]);

  // Défilement infini : quand le bas du fil approche, on charge la page suivante
  useEffect(() => {
    const cible = sentinelle.current;
    if (!cible || !encore || chargementSuite || erreurSuite) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) void chargerSuite();
      },
      { rootMargin: "600px 0px" },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [encore, chargementSuite, erreurSuite, chargerSuite]);

  const fermer = useCallback(() => setOuvert(null), []);
  const surLu = useCallback(() => {
    if (ouvert) setLus((s) => new Set(s).add(`${ouvert.type}-${ouvert.id}`));
  }, [ouvert]);

  if (premiere.erreur) {
    return (
      <Carte className="flex flex-wrap items-center gap-3 p-5 text-sm text-site-muted">
        <span>Impossible de charger le fil.</span>
        <button type="button" className={BOUTON_PETIT} onClick={premiere.reessayer}>
          Réessayer
        </button>
      </Carte>
    );
  }

  if (premiere.chargement && !premiere.donnees) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SqueletteCarte />
        <SqueletteCarte />
        <span className="sr-only">Chargement…</span>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Carte className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
          <Newspaper size={22} aria-hidden />
        </span>
        <p className="font-display text-base font-semibold">Rien à afficher pour le moment</p>
        <p className="max-w-xs text-sm text-site-muted">
          Les actualités, annonces et notes de votre entreprise apparaîtront ici dès leur publication.
        </p>
      </Carte>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {posts.map((p) => (
          <Publication
            key={`${p.type}-${p.id}`}
            post={p}
            lu={p.lu === true || lus.has(`${p.type}-${p.id}`)}
            onOuvrir={() => setOuvert({ type: p.type, id: p.id, titre: p.titre })}
          />
        ))}
      </div>

      <div ref={sentinelle} className="py-6 text-center text-sm text-site-muted" aria-live="polite">
        {chargementSuite ? (
          <div className="space-y-4">
            <SqueletteCarte />
          </div>
        ) : erreurSuite ? (
          <span className="inline-flex flex-wrap items-center justify-center gap-3">
            Impossible de charger la suite.
            <button type="button" className={BOUTON_PETIT} onClick={() => void chargerSuite()}>
              Réessayer
            </button>
          </span>
        ) : encore ? (
          <button type="button" className={BOUTON_PETIT} onClick={() => void chargerSuite()}>
            Charger plus
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} aria-hidden /> Vous avez tout vu
          </span>
        )}
      </div>

      {ouvert && <LecteurContenu ouvert={ouvert} onFermer={fermer} onLu={surLu} />}
    </>
  );
}

// ---- Écran Accueil -----------------------------------------------------------------

const TYPES_CONTENU: TypeContenu[] = ["actualite", "annonce", "article", "note_service"];

// « ?ouvrir=actualite-12 » : publication à ouvrir directement (clic sur une notification)
function lireCible(valeur: string | null): Ouvert | null {
  const m = valeur?.match(/^([a-z_]+)-(\d+)$/);
  if (!m || !TYPES_CONTENU.includes(m[1] as TypeContenu)) return null;
  return { type: m[1] as TypeContenu, id: Number(m[2]), titre: "" };
}

export function FilActualite() {
  const { profil } = useEspace();
  const router = useRouter();
  const cible = lireCible(useSearchParams().get("ouvrir"));
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [version, setVersion] = useState(0);
  const fermerCible = useCallback(() => router.replace("/espace/accueil"), [router]);

  const disponibles = useMemo(
    () =>
      TYPES.filter(
        (t) => profil.modules_actifs.includes(t.module) && profil.permissions.includes(`${t.module}.consulter`),
      ),
    [profil],
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Accueil</h1>
          <p className="mt-1 text-sm text-site-muted">Les dernières publications de votre entreprise.</p>
        </div>
        <button type="button" onClick={() => setVersion((v) => v + 1)} className={BOUTON_PETIT}>
          <RefreshCw size={13} aria-hidden /> Actualiser
        </button>
      </div>

      {disponibles.length > 1 && (
        <div role="tablist" aria-label="Filtrer par type" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ type: "tous" as const, libelle: "Tout" }, ...disponibles].map((t) => (
            <button
              key={t.type}
              type="button"
              role="tab"
              aria-selected={filtre === t.type}
              onClick={() => setFiltre(t.type)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filtre === t.type
                  ? "v-gradient-btn border-transparent text-white"
                  : "border-site-line text-site-ink hover:border-brand-violet/60",
              )}
            >
              {t.libelle}
            </button>
          ))}
        </div>
      )}

      {disponibles.length === 0 ? (
        <Carte className="p-6 text-center text-sm text-site-muted">
          Aucun module de publication n&apos;est activé pour votre entreprise.
        </Carte>
      ) : (
        <Flux key={`${filtre}-${version}`} type={filtre} />
      )}

      {cible && <LecteurContenu key={`${cible.type}-${cible.id}`} ouvert={cible} onFermer={fermerCible} onLu={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

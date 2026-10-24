"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Mail, Phone, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDonnees } from "./use-donnees";
import { Avatar, aplatirOrga, formaterDate, type Employe, type Fiche, type LienEmploye, type NoeudOrga, type Pagination } from "./annuaire-commun";
import { Organigramme } from "./organigramme";
import { OrganigrammePersonnes, type PersonneOrga } from "./organigramme-personnes";

// Organigramme en lecture seule : par personnes (qui dépend de qui) ou par départements.
// Un clic sur une personne ouvre sa fiche, « Voir l'équipe » liste les membres d'un département.

type Onglet = "personnes" | "departements";

const ONGLETS: { code: Onglet; libelle: string }[] = [
  { code: "personnes", libelle: "Par personnes" },
  { code: "departements", libelle: "Par départements" },
];

function Tiroir({ titre, sousTitre, onFermer, echap = true, children }: { titre: string; sousTitre?: string; onFermer: () => void; echap?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!echap) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [echap, onFermer]);

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-site-line px-5">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold">{titre}</h2>
            {sousTitre && <p className="truncate text-xs text-site-muted">{sousTitre}</p>}
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ErreurPanneau({ texte, onReessayer }: { texte: string; onReessayer?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
      <span>{texte}</span>
      {onReessayer && (
        <button type="button" onClick={onReessayer} className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60">
          Réessayer
        </button>
      )}
    </div>
  );
}

function LignePersonne({ p, onOuvrir }: { p: LienEmploye; onOuvrir: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOuvrir(p.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-site-line px-3 py-2 text-left transition-colors hover:border-brand-violet/60"
    >
      <Avatar personne={p} taille="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {p.prenom} {p.nom}
        </span>
        {p.poste && <span className="block truncate text-xs text-site-muted">{p.poste}</span>}
      </span>
    </button>
  );
}

// ---- Fiche d'une personne --------------------------------------------------------

function PanneauFiche({ id, onFermer, onOuvrir }: { id: number; onFermer: () => void; onOuvrir: (id: number) => void }) {
  const charger = useCallback((jeton: string) => api<Fiche>(`/annuaire/${id}`, { token: jeton }), [id]);
  const fiche = useDonnees(true, charger);
  const f = fiche.donnees;
  const embauche = f ? formaterDate(f.date_embauche) : null;

  return (
    <Tiroir titre={f ? `${f.prenom} ${f.nom}` : "Fiche"} sousTitre={f?.poste ?? undefined} onFermer={onFermer}>
      {fiche.erreur ? (
        <ErreurPanneau texte="Cette fiche n’est pas disponible. La personne a peut-être été désactivée." onReessayer={fiche.reessayer} />
      ) : fiche.chargement || !f ? (
        <div className="space-y-4 p-6" aria-hidden>
          <div className="size-20 animate-pulse rounded-full bg-site-line" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-site-line" />
          <div className="h-3 w-32 animate-pulse rounded-md bg-site-line" />
        </div>
      ) : (
        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar personne={f} taille="lg" />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">
                {f.prenom} {f.nom}
              </p>
              {f.poste && <p className="text-sm text-site-muted">{f.poste}</p>}
              {f.nom_departement && (
                <span className="mt-1.5 inline-flex max-w-full rounded-full bg-brand-blue/15 px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
                  <span className="truncate">{f.nom_departement}</span>
                </span>
              )}
            </div>
          </div>

          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-3">
              <Mail size={16} aria-hidden className="shrink-0 text-site-muted" />
              <a href={`mailto:${f.email}`} className="min-w-0 truncate text-brand-violet hover:underline">
                {f.email}
              </a>
            </li>
            {f.telephone && (
              <li className="flex items-center gap-3">
                <Phone size={16} aria-hidden className="shrink-0 text-site-muted" />
                <a href={`tel:${f.telephone}`} className="hover:underline">
                  {f.telephone}
                </a>
              </li>
            )}
            {embauche && (
              <li className="flex items-center gap-3">
                <CalendarDays size={16} aria-hidden className="shrink-0 text-site-muted" />
                <span>Dans l’entreprise depuis le {embauche}</span>
              </li>
            )}
          </ul>

          {f.superieur && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-site-muted">Supérieur hiérarchique</h3>
              <LignePersonne p={f.superieur} onOuvrir={onOuvrir} />
            </section>
          )}

          {f.subordonnes.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-site-muted">Équipe directe ({f.subordonnes.length})</h3>
              <ul className="space-y-2">
                {f.subordonnes.map((s) => (
                  <li key={s.id}>
                    <LignePersonne p={s} onOuvrir={onOuvrir} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Tiroir>
  );
}

// ---- Membres d'un département -------------------------------------------------------

function PanneauEquipe({ departement, onFermer, onOuvrir, echap }: { departement: { id: number; nom: string }; onFermer: () => void; onOuvrir: (id: number) => void; echap: boolean }) {
  const [page, setPage] = useState(1);
  const charger = useCallback((jeton: string) => api<Pagination<Employe>>(`/annuaire?departement_id=${departement.id}&page=${page}`, { token: jeton }), [departement.id, page]);
  const liste = useDonnees(true, charger);
  const res = liste.donnees;

  return (
    <Tiroir titre={departement.nom} sousTitre={res ? `${res.total} personne${res.total > 1 ? "s" : ""}` : undefined} onFermer={onFermer} echap={echap}>
      {liste.erreur ? (
        <ErreurPanneau texte="Impossible de charger l’équipe." onReessayer={liste.reessayer} />
      ) : liste.chargement || !res ? (
        <ul className="space-y-2 p-5" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl bg-site-line" />
          ))}
        </ul>
      ) : res.data.length === 0 ? (
        <p className="p-6 text-sm text-site-muted">Aucune personne dans ce département.</p>
      ) : (
        <div className="p-5">
          <ul className="space-y-2">
            {res.data.map((e) => (
              <li key={e.id}>
                <LignePersonne p={e} onOuvrir={onOuvrir} />
              </li>
            ))}
          </ul>
          {res.last_page > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={res.current_page <= 1} aria-label="Page précédente" className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40">
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span className="text-site-muted">
                Page {res.current_page} sur {res.last_page}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(res.last_page, p + 1))} disabled={res.current_page >= res.last_page} aria-label="Page suivante" className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40">
                <ChevronRight size={16} aria-hidden />
              </button>
            </nav>
          )}
        </div>
      )}
    </Tiroir>
  );
}

// ---- Écran --------------------------------------------------------------------------

export function OrganigrammeConsultation() {
  const [onglet, setOnglet] = useState<Onglet>("personnes");
  const [ficheId, setFicheId] = useState<number | null>(null);
  const [equipe, setEquipe] = useState<{ id: number; nom: string } | null>(null);

  const chargerPersonnes = useCallback((jeton: string) => api<PersonneOrga[]>("/organigramme/personnes", { token: jeton }), []);
  const personnes = useDonnees(onglet === "personnes", chargerPersonnes);

  const chargerOrga = useCallback((jeton: string) => api<NoeudOrga[]>("/organigramme", { token: jeton }), []);
  const orga = useDonnees(onglet === "departements", chargerOrga);
  const departements = useMemo(() => (orga.donnees ? aplatirOrga(orga.donnees) : []), [orga.donnees]);

  const ouvrirFiche = useCallback((id: number) => setFicheId(id), []);
  const fermerFiche = useCallback(() => setFicheId(null), []);
  const fermerEquipe = useCallback(() => setEquipe(null), []);
  const voirEquipe = useCallback(
    (id: number) => {
      const d = departements.find((x) => x.id === id);
      setEquipe({ id, nom: d?.nom_departement ?? "Équipe" });
    },
    [departements],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Organigramme</h1>
        <p className="mt-1 text-sm text-site-muted">Découvrez comment l’entreprise est organisée et qui travaille avec qui.</p>
      </header>

      <div role="tablist" aria-label="Affichage" className="inline-flex rounded-full border border-site-line bg-site-surface p-1">
        {ONGLETS.map((o) => {
          const actif = onglet === o.code;
          return (
            <button
              key={o.code}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setOnglet(o.code)}
              className={cn("h-9 rounded-full px-4 text-sm font-semibold transition-colors", actif ? "v-gradient-btn" : "text-site-muted hover:text-site-ink")}
            >
              {o.libelle}
            </button>
          );
        })}
      </div>

      {onglet === "personnes" ? (
        <OrganigrammePersonnes personnes={personnes.donnees} erreur={personnes.erreur} onReessayer={personnes.reessayer} onOuvrir={ouvrirFiche} lectureSeule />
      ) : (
        <Organigramme noeuds={orga.donnees} erreur={orga.erreur} onReessayer={orga.reessayer} onOuvrirPersonne={ouvrirFiche} onVoirEquipe={voirEquipe} lectureSeule />
      )}

      {equipe && <PanneauEquipe key={equipe.id} departement={equipe} onFermer={fermerEquipe} onOuvrir={ouvrirFiche} echap={ficheId === null} />}
      {ficheId !== null && <PanneauFiche key={ficheId} id={ficheId} onFermer={fermerFiche} onOuvrir={ouvrirFiche} />}
    </div>
  );
}

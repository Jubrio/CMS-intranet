"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./annuaire-commun";

export type PersonneOrga = {
  id: number;
  nom: string;
  prenom: string;
  poste: string | null;
  photo: string | null;
  superieur_id: number | null;
  nom_departement: string | null;
};

type Noeud = PersonneOrga & { enfants: Noeud[] };

const LIGNE = "bg-brand-violet/35";

// Liste à plat → forêt. Les personnes sans supérieur actif deviennent des racines ; celles qui ne
// sont rattachées à aucune racine (boucle de données) sont signalées à part.
function construire(personnes: PersonneOrga[]) {
  const noeuds = new Map<number, Noeud>(personnes.map((p) => [p.id, { ...p, enfants: [] }]));
  const racines: Noeud[] = [];
  for (const n of noeuds.values()) {
    const parent = n.superieur_id && n.superieur_id !== n.id ? noeuds.get(n.superieur_id) : undefined;
    if (parent) parent.enfants.push(n);
    else racines.push(n);
  }

  const atteints = new Set<number>();
  const visiter = (n: Noeud) => {
    if (atteints.has(n.id)) return;
    atteints.add(n.id);
    n.enfants.forEach(visiter);
  };
  racines.forEach(visiter);

  const arbres = racines.filter((r) => r.enfants.length > 0).sort((a, b) => b.enfants.length - a.enfants.length);
  const isoles = [...racines.filter((r) => r.enfants.length === 0), ...[...noeuds.values()].filter((n) => !atteints.has(n.id))];
  return { arbres, isoles };
}

function Carte({ p, accent, onOuvrir }: { p: PersonneOrga; accent?: boolean; onOuvrir: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOuvrir(p.id)}
      title={`${p.prenom} ${p.nom}${p.poste ? ` — ${p.poste}` : ""}`}
      className={cn(
        "flex h-14 w-full items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-left shadow-sm transition-colors hover:border-brand-violet/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40",
        accent ? "border-brand-violet/40 bg-brand-violet/15" : "border-brand-blue/30 bg-brand-blue/10",
      )}
    >
      <Avatar personne={p} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] text-site-muted">
          {p.prenom} {p.nom}
        </span>
        <span className="block truncate text-xs font-bold">{p.poste || "Poste non renseigné"}</span>
      </span>
    </button>
  );
}

// Équipe empilée sous un responsable : trait vertical à gauche, petit trait vers chaque carte (h-14 = 3,5 rem)
function Pile({ noeuds, retrait, onOuvrir }: { noeuds: Noeud[]; retrait: string; onOuvrir: (id: number) => void }) {
  return (
    <ul className={retrait}>
      {noeuds.map((n, i) => (
        <li key={n.id} className="relative pl-6 pt-3">
          <span aria-hidden className={cn("absolute left-0 top-0 w-px", LIGNE, i === noeuds.length - 1 ? "h-10" : "h-full")} />
          <span aria-hidden className={cn("absolute left-0 top-10 h-px w-6", LIGNE)} />
          <Carte p={n} onOuvrir={onOuvrir} />
          {n.enfants.length > 0 && <Pile noeuds={n.enfants} retrait="ml-6" onOuvrir={onOuvrir} />}
        </li>
      ))}
    </ul>
  );
}

function Arbre({ racine, onOuvrir }: { racine: Noeud; onOuvrir: (id: number) => void }) {
  const dernier = racine.enfants.length - 1;
  return (
    <div className="flex flex-col items-center">
      <div className="w-64">
        <Carte p={racine} accent onOuvrir={onOuvrir} />
      </div>
      <span aria-hidden className={cn("block h-6 w-px", LIGNE)} />
      <ul className="flex justify-center">
        {racine.enfants.map((n, i) => (
          <li key={n.id} className="relative w-72 shrink-0 px-4 pt-6">
            <span aria-hidden className={cn("absolute left-1/2 top-0 h-6 w-px", LIGNE)} />
            {i > 0 && <span aria-hidden className={cn("absolute left-0 top-0 h-px w-1/2", LIGNE)} />}
            {i < dernier && <span aria-hidden className={cn("absolute right-0 top-0 h-px w-1/2", LIGNE)} />}
            <Carte p={n} accent onOuvrir={onOuvrir} />
            {n.enfants.length > 0 && <Pile noeuds={n.enfants} retrait="ml-10" onOuvrir={onOuvrir} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  personnes: PersonneOrga[] | null;
  erreur: boolean;
  onReessayer: () => void;
  onOuvrir: (id: number) => void;
  // Consultation : les messages ne renvoient pas vers des écrans de gestion
  lectureSeule?: boolean;
};

export function OrganigrammePersonnes({ personnes, erreur, onReessayer, onOuvrir, lectureSeule }: Props) {
  const { arbres, isoles } = useMemo(() => (personnes ? construire(personnes) : { arbres: [], isoles: [] }), [personnes]);

  if (erreur) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted shadow-sm">
        <span>Impossible de charger l’organigramme. Votre rôle doit aussi pouvoir consulter l’annuaire.</span>
        <button type="button" onClick={onReessayer} className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60">
          Réessayer
        </button>
      </div>
    );
  }

  if (personnes === null) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="mx-auto h-14 w-64 animate-pulse rounded-full bg-site-line" />
        <div className="flex justify-center gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-14 w-56 animate-pulse rounded-full bg-site-line" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {arbres.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-site-line bg-site-surface p-6 shadow-sm">
          <div className="flex w-max min-w-full justify-center gap-12">
            {arbres.map((r) => (
              <Arbre key={r.id} racine={r} onOuvrir={onOuvrir} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-site-line bg-site-surface px-6 py-14 text-center shadow-sm">
          <p className="text-sm font-medium">Aucun lien hiérarchique renseigné pour le moment.</p>
          <p className="mt-1 text-xs text-site-muted">
            {lectureSeule ? "Les liens hiérarchiques n’ont pas encore été renseignés." : "Ouvrez la fiche d’un employé et choisissez son supérieur hiérarchique pour construire l’organigramme."}
          </p>
        </div>
      )}

      {isoles.length > 0 && (
        <section className="rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm">
          <h2 className="font-display text-sm font-semibold">Sans rattachement hiérarchique ({isoles.length})</h2>
          <p className="mt-1 text-xs text-site-muted">
            {lectureSeule ? "Ces personnes n’ont ni supérieur ni subordonné renseigné." : "Ces personnes n’ont ni supérieur ni subordonné renseigné. Ouvrez leur fiche pour les placer dans l’organigramme."}
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {isoles.map((p) => (
              <li key={p.id}>
                <Carte p={p} onOuvrir={onOuvrir} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

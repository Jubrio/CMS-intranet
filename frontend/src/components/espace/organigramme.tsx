"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, effectifTotal, nombre, type NoeudOrga } from "./annuaire-commun";

function idsAvecEnfants(noeuds: NoeudOrga[]): number[] {
  return noeuds.flatMap((n) => (n.enfants.length > 0 ? [n.id, ...idsAvecEnfants(n.enfants)] : []));
}

type PropsBranche = {
  noeuds: NoeudOrga[];
  repliees: Set<number>;
  onBasculer: (id: number) => void;
  onOuvrirPersonne: (id: number) => void;
  onVoirEquipe: (departementId: number) => void;
};

function Branche({ noeuds, repliees, onBasculer, onOuvrirPersonne, onVoirEquipe }: PropsBranche) {
  return (
    <ul className="space-y-3">
      {noeuds.map((n) => {
        const aDesEnfants = n.enfants.length > 0;
        const ouvert = !repliees.has(n.id);
        const total = effectifTotal(n);
        return (
          <li key={n.id}>
            <div className="rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                {aDesEnfants ? (
                  <button
                    type="button"
                    onClick={() => onBasculer(n.id)}
                    aria-expanded={ouvert}
                    aria-label={`${ouvert ? "Replier" : "Déplier"} ${n.nom_departement}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet transition-colors hover:bg-brand-violet/25"
                  >
                    <ChevronDown size={18} aria-hidden className={cn("transition-transform", !ouvert && "-rotate-90")} />
                  </button>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                    <Building2 size={18} aria-hidden />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold">{n.nom_departement}</p>
                  <p className="text-xs text-site-muted">
                    {nombre.format(n.nb_employes)} employé{n.nb_employes > 1 ? "s" : ""}
                    {aDesEnfants && ` · ${nombre.format(total)} avec les sous-départements`}
                  </p>
                </div>

                {n.responsable ? (
                  <button
                    type="button"
                    onClick={() => onOuvrirPersonne(n.responsable!.id)}
                    className="flex max-w-full items-center gap-2 rounded-full border border-site-line py-1 pl-1 pr-3 text-left transition-colors hover:border-brand-violet/60"
                  >
                    <Avatar personne={n.responsable} taille="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {n.responsable.prenom} {n.responsable.nom}
                      </span>
                      <span className="block truncate text-[10px] text-site-muted">{n.responsable.poste || "Responsable"}</span>
                    </span>
                  </button>
                ) : (
                  <span className="rounded-full bg-site-line px-3 py-1 text-[11px] font-medium text-site-muted">Sans responsable</span>
                )}

                <button
                  type="button"
                  onClick={() => onVoirEquipe(n.id)}
                  disabled={n.nb_employes === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-site-line px-3 text-xs font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Users size={14} aria-hidden />
                  Voir l’équipe
                </button>
              </div>
            </div>

            {aDesEnfants && ouvert && (
              <div className="ml-5 mt-3 border-l border-site-line pl-5">
                <Branche noeuds={n.enfants} repliees={repliees} onBasculer={onBasculer} onOuvrirPersonne={onOuvrirPersonne} onVoirEquipe={onVoirEquipe} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  noeuds: NoeudOrga[] | null;
  erreur: boolean;
  onReessayer: () => void;
  onOuvrirPersonne: (id: number) => void;
  onVoirEquipe: (departementId: number) => void;
  // Consultation : les messages ne renvoient pas vers des écrans de gestion
  lectureSeule?: boolean;
};

export function Organigramme({ noeuds, erreur, onReessayer, onOuvrirPersonne, onVoirEquipe, lectureSeule }: Props) {
  const [repliees, setRepliees] = useState<Set<number>>(new Set());
  const repliables = useMemo(() => (noeuds ? idsAvecEnfants(noeuds) : []), [noeuds]);

  function basculer(id: number) {
    setRepliees((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

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

  if (noeuds === null) {
    return (
      <div className="space-y-3" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-site-line" style={{ marginLeft: i > 0 ? 24 : 0 }} />
        ))}
      </div>
    );
  }

  if (noeuds.length === 0) {
    return (
      <div className="rounded-2xl border border-site-line bg-site-surface px-6 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
          <Building2 size={22} aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium">Aucun département pour le moment.</p>
        <p className="mt-1 text-xs text-site-muted">
          {lectureSeule ? "L’organigramme apparaîtra dès que les départements auront été créés." : "Créez vos départements depuis l’écran Départements pour construire l’organigramme."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {repliables.length > 0 && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRepliees(new Set())} disabled={repliees.size === 0} className="h-8 rounded-full border border-site-line px-3 text-xs font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40">
            Tout déplier
          </button>
          <button type="button" onClick={() => setRepliees(new Set(repliables))} disabled={repliees.size >= repliables.length} className="h-8 rounded-full border border-site-line px-3 text-xs font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-40">
            Tout replier
          </button>
        </div>
      )}
      <Branche noeuds={noeuds} repliees={repliees} onBasculer={basculer} onOuvrirPersonne={onOuvrirPersonne} onVoirEquipe={onVoirEquipe} />
    </div>
  );
}

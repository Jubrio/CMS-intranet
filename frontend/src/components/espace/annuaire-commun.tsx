"use client";

import { useState } from "react";
import { urlStockage } from "@/lib/api";
import { initiales } from "@/lib/espace";
import { cn } from "@/lib/utils";

export type Pagination<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

export type Employe = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  poste: string | null;
  photo: string | null;
  departement_id: number | null;
  nom_departement: string | null;
};

export type LienEmploye = { id: number; nom: string; prenom: string; poste: string | null };

export type Fiche = Employe & {
  date_embauche: string | null;
  superieur_id: number | null;
  superieur: LienEmploye | null;
  subordonnes: LienEmploye[];
};

export type NoeudOrga = {
  id: number;
  nom_departement: string;
  responsable: LienEmploye | null;
  nb_employes: number;
  enfants: NoeudOrga[];
};

export type OptionDepartement = { id: number; nom_departement: string; profondeur: number };

// ---- Aides ---------------------------------------------------------------------

export const nombre = new Intl.NumberFormat("fr-FR");
export const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const jourLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function formaterDate(valeur: string | null): string | null {
  if (!valeur) return null;
  const [a, m, j] = valeur.slice(0, 10).split("-").map(Number);
  if (!a || !m || !j) return null;
  return jourLong.format(new Date(a, m - 1, j));
}

export function aplatirOrga(noeuds: NoeudOrga[], profondeur = 0): OptionDepartement[] {
  return noeuds.flatMap((n) => [
    { id: n.id, nom_departement: n.nom_departement, profondeur },
    ...aplatirOrga(n.enfants, profondeur + 1),
  ]);
}

export function effectifTotal(n: NoeudOrga): number {
  return n.nb_employes + n.enfants.reduce((s, e) => s + effectifTotal(e), 0);
}

export const libelleDepartement = (d: OptionDepartement) => `${"— ".repeat(d.profondeur)}${d.nom_departement}`;

const TAILLES = {
  sm: "size-8 text-[11px]",
  md: "size-11 text-sm",
  lg: "size-20 text-2xl",
} as const;

export function Avatar({
  personne,
  taille = "md",
}: {
  personne: { prenom: string; nom: string; photo?: string | null };
  taille?: keyof typeof TAILLES;
}) {
  const [echec, setEchec] = useState<string | null>(null);
  const afficher = personne.photo && echec !== personne.photo;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-violet/15 font-semibold text-brand-violet",
        TAILLES[taille],
      )}
    >
      {afficher ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlStockage(personne.photo as string)}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setEchec(personne.photo ?? null)}
        />
      ) : (
        initiales(personne)
      )}
    </span>
  );
}

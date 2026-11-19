"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { estSuperAdmin } from "@/lib/espace";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";

type Operation = {
  id: number;
  utilisateur_libelle: string | null;
  action: string;
  cible_type: string;
  cible_id: number | null;
  cible_libelle: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type PageJournal = {
  data: Operation[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

const ACTIONS: Record<string, string> = {
  suspendre: "a suspendu",
  reactiver: "a réactivé",
  supprimer: "a supprimé",
  ajouter: "a ajouté",
  modifier: "a modifié",
  desactiver: "a désactivé",
  retirer: "a retiré",
};

const CIBLES: Record<string, string> = { entreprise: "l'entreprise", module: "le module" };

export function Journal() {
  const { profil } = useEspace();
  const autorise = estSuperAdmin(profil);

  const [page, setPage] = useState(1);
  const [saisie, setSaisie] = useState("");
  const [entrepriseId, setEntrepriseId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setEntrepriseId(/^\d+$/.test(saisie.trim()) ? saisie.trim() : "");
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const requete = useMemo(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (entrepriseId) p.set("entreprise_id", entrepriseId);
    return p.toString();
  }, [page, entrepriseId]);

  const charger = useCallback((jeton: string) => api<PageJournal>(`/super/journal?${requete}`, { token: jeton }), [requete]);
  const { donnees, chargement, erreur, reessayer } = useDonnees(autorise, charger);

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Cet écran est réservé au super-administrateur.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Journal des opérations</h1>
        <p className="mt-1 text-sm text-site-muted">
          Historique des opérations effectuées sur les entreprises et le catalogue de modules (lecture seule).
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-site-muted">Filtrer par n° d&apos;entreprise</span>
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          inputMode="numeric"
          placeholder="Ex. 12"
          className="w-40 rounded-xl border border-site-line bg-site-surface px-3 py-2"
        />
      </label>

      {erreur ? (
        <div className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm">
          Impossible de charger le journal.{" "}
          <button type="button" onClick={reessayer} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : chargement || !donnees ? (
        <p className="text-sm text-site-muted">Chargement…</p>
      ) : donnees.data.length === 0 ? (
        <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
          Aucune opération enregistrée.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-site-line rounded-2xl border border-site-line bg-site-surface">
            {donnees.data.map((o) => (
              <li key={o.id} className="flex flex-col gap-1 p-4 text-sm md:flex-row md:items-baseline md:justify-between">
                <span>
                  <strong>{o.utilisateur_libelle ?? "Compte supprimé"}</strong> {ACTIONS[o.action] ?? o.action}{" "}
                  {CIBLES[o.cible_type] ?? o.cible_type} <strong>{o.cible_libelle ?? `#${o.cible_id ?? "?"}`}</strong>
                </span>
                <time dateTime={o.created_at} className="text-site-muted">
                  {format(parseISO(o.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                </time>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-sm text-site-muted">
            <span>
              Page {donnees.current_page} sur {donnees.last_page} · {donnees.total} opération(s)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Page précédente"
                disabled={donnees.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-site-line p-2 disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Page suivante"
                disabled={donnees.current_page >= donnees.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-site-line p-2 disabled:opacity-40"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

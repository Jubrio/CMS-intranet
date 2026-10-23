"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Contact, Mail, Network, Phone, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { Avatar, aplatirOrga, libelleDepartement, nombre, type Employe, type NoeudOrga, type Pagination } from "./annuaire-commun";
import { AnnuaireFiche } from "./annuaire-fiche";
import { Organigramme } from "./organigramme";
import { OrganigrammePersonnes, type PersonneOrga } from "./organigramme-personnes";

type Onglet = "annuaire" | "organigramme";
type VueOrga = "personnes" | "departements";

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

export function Annuaire() {
  const { profil } = useEspace();
  const autorise = profil.permissions.includes("annuaire.gerer");

  const [onglet, setOnglet] = useState<Onglet>("annuaire");
  const [vueOrga, setVueOrga] = useState<VueOrga>("personnes");
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [departement, setDepartement] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [ficheId, setFicheId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Organigramme : sert à l'onglet du même nom, au filtre et au choix du département
  const chargerOrga = useCallback(
    async (jeton: string) => {
      void version;
      return api<NoeudOrga[]>("/organigramme", { token: jeton });
    },
    [version],
  );
  const orga = useDonnees(autorise, chargerOrga);
  const departements = useMemo(() => (orga.donnees ? aplatirOrga(orga.donnees) : []), [orga.donnees]);
  // Un département qui n'existe plus ne filtre plus
  const departementActif = orga.donnees === null || departements.some((d) => String(d.id) === departement) ? departement : "";

  // Organigramme des personnes : chargé seulement quand on l'affiche
  const chargerPersonnes = useCallback(
    async (jeton: string) => {
      void version;
      return api<PersonneOrga[]>("/organigramme/personnes", { token: jeton });
    },
    [version],
  );
  const personnes = useDonnees(autorise && onglet === "organigramme" && vueOrga === "personnes", chargerPersonnes);

  // Annuaire filtré
  const cleCourante = `${page}|${q}|${departementActif}|${version}`;
  const chargerListe = useCallback(
    async (jeton: string) => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set("q", q);
      if (departementActif) p.set("departement_id", departementActif);
      const res = await api<Pagination<Employe>>(`/annuaire?${p.toString()}`, { token: jeton });
      // Dernière page vidée : on recule jusqu'à la dernière page existante
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [page, q, departementActif, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;

  const fermerFiche = useCallback(() => setFicheId(null), []);

  const voirEquipe = useCallback((departementId: number) => {
    setFicheId(null);
    setOnglet("annuaire");
    setSaisie("");
    setQ("");
    setDepartement(String(departementId));
    setPage(1);
  }, []);

  const apresModification = useCallback((message?: string) => {
    if (message) setNotice(message);
    setVersion((v) => v + 1);
  }, []);

  if (!autorise) {
    return <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">Vous n’avez pas accès à la gestion de l’annuaire.</p>;
  }

  const filtre = q !== "" || departementActif !== "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Annuaire et organigramme</h1>
        <p className="mt-1 text-sm text-site-muted">Retrouvez vos collègues, tenez leurs fiches à jour et visualisez l’organisation de l’entreprise.</p>
      </div>

      {notice && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-4 py-3 text-sm text-brand-cyan">
          {notice}
          <button type="button" aria-label="Masquer le message" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={16} aria-hidden />
          </button>
        </p>
      )}

      <div role="tablist" aria-label="Affichage" className="inline-flex rounded-full border border-site-line bg-site-surface p-1">
        {(
          [
            { cle: "annuaire", libelle: "Annuaire", icone: Contact },
            { cle: "organigramme", libelle: "Organigramme", icone: Network },
          ] as const
        ).map(({ cle, libelle, icone: Icone }) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={onglet === cle}
            onClick={() => setOnglet(cle)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              onglet === cle ? "bg-brand-violet/15 text-brand-violet" : "text-site-muted hover:text-site-ink",
            )}
          >
            <Icone size={16} aria-hidden />
            {libelle}
          </button>
        ))}
      </div>

      {onglet === "organigramme" ? (
        <div className="space-y-4">
          <div role="group" aria-label="Type d’organigramme" className="flex gap-2">
            {(
              [
                { cle: "personnes", libelle: "Par personnes" },
                { cle: "departements", libelle: "Par départements" },
              ] as const
            ).map(({ cle, libelle }) => (
              <button
                key={cle}
                type="button"
                aria-pressed={vueOrga === cle}
                onClick={() => setVueOrga(cle)}
                className={cn(
                  "h-8 rounded-full border px-4 text-xs font-semibold transition-colors",
                  vueOrga === cle ? "border-brand-violet/60 bg-brand-violet/15 text-brand-violet" : "border-site-line text-site-muted hover:text-site-ink",
                )}
              >
                {libelle}
              </button>
            ))}
          </div>
          {vueOrga === "personnes" ? (
            <OrganigrammePersonnes personnes={personnes.donnees} erreur={personnes.erreur} onReessayer={personnes.reessayer} onOuvrir={setFicheId} />
          ) : (
            <Organigramme noeuds={orga.donnees} erreur={orga.erreur} onReessayer={orga.reessayer} onOuvrirPersonne={setFicheId} onVoirEquipe={voirEquipe} />
          )}
        </div>
      ) : (
        <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-site-line p-4">
            <div className="relative min-w-52 max-w-md flex-1">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted" />
              <input
                type="search"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="Rechercher un nom, un poste, un département"
                aria-label="Rechercher dans l’annuaire"
                className={cn(CHAMP, "pl-9")}
              />
            </div>
            {departements.length > 0 && (
              <select
                value={departementActif}
                onChange={(e) => {
                  setDepartement(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrer par département"
                className={cn(CHAMP, "w-auto min-w-48")}
              >
                <option value="">Tous les départements</option>
                {departements.map((d) => (
                  <option key={d.id} value={d.id}>
                    {libelleDepartement(d)}
                  </option>
                ))}
              </select>
            )}
            {filtre && (
              <button
                type="button"
                onClick={() => {
                  setSaisie("");
                  setQ("");
                  setDepartement("");
                  setPage(1);
                }}
                className="inline-flex h-10 items-center rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {liste.erreur ? (
            <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
              <span>Impossible de charger l’annuaire. Votre rôle doit aussi pouvoir consulter l’annuaire.</span>
              <button type="button" onClick={liste.reessayer} className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60">
                Réessayer
              </button>
            </div>
          ) : enChargement ? (
            <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-site-line p-4">
                  <Squelette className="size-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Squelette className="h-3.5 w-32" />
                    <Squelette className="h-3 w-24" />
                  </div>
                </li>
              ))}
            </ul>
          ) : !res || res.data.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
                <Contact size={22} aria-hidden />
              </span>
              <p className="mt-4 text-sm font-medium">{filtre ? "Aucune personne ne correspond à cette recherche." : "Aucun employé dans l’annuaire."}</p>
              {filtre && <p className="mt-1 text-xs text-site-muted">La recherche porte sur un seul mot à la fois : essayez le nom ou le prénom seul.</p>}
            </div>
          ) : (
            <div>
              <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {res.data.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setFicheId(e.id)}
                      className="flex h-full w-full items-start gap-3 rounded-xl border border-site-line p-4 text-left transition-colors hover:border-brand-violet/60 hover:bg-site-surface2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
                    >
                      <Avatar personne={e} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {e.prenom} {e.nom}
                        </span>
                        <span className="block truncate text-xs text-site-muted">{e.poste || "Poste non renseigné"}</span>
                        {e.nom_departement && (
                          <span className="mt-1.5 inline-flex max-w-full rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                            <span className="truncate">{e.nom_departement}</span>
                          </span>
                        )}
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-site-muted">
                          <Mail size={12} aria-hidden className="shrink-0" />
                          <span className="truncate">{e.email}</span>
                        </span>
                        {e.telephone && (
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-site-muted">
                            <Phone size={12} aria-hidden className="shrink-0" />
                            <span className="truncate">{e.telephone}</span>
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-site-line px-5 py-3">
                <p className="text-xs text-site-muted">
                  {res.last_page > 1 && `Page ${res.current_page} sur ${res.last_page} · `}
                  {nombre.format(res.total)} personne{res.total > 1 ? "s" : ""}
                </p>
                {res.last_page > 1 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((n) => Math.max(1, n - 1))}
                      disabled={res.current_page <= 1}
                      aria-label="Page précédente"
                      className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((n) => Math.min(res.last_page, n + 1))}
                      disabled={res.current_page >= res.last_page}
                      aria-label="Page suivante"
                      className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                )}
              </nav>
            </div>
          )}
        </section>
      )}

      {ficheId !== null && (
        <AnnuaireFiche key={ficheId} id={ficheId} departements={departements} onFermer={fermerFiche} onOuvrir={setFicheId} onVoirEquipe={voirEquipe} onModifie={apresModification} />
      )}
    </div>
  );
}

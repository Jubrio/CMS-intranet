"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type LucideIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Presentation,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError, messageErreur, telechargerFichier } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import type { DepartementOption } from "./contenu-formulaire";
import { DocumentFormulaire, formaterTaille, type DocumentFichier } from "./document-formulaire";

type Pagination<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

const nombre = new Intl.NumberFormat("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function famille(mime: string): { icone: LucideIcon; etiquette: string } {
  if (mime === "application/pdf") return { icone: FileText, etiquette: "PDF" };
  if (mime.includes("word") || mime === "application/msword") return { icone: FileText, etiquette: "Word" };
  if (mime.includes("sheet") || mime.includes("excel")) return { icone: FileSpreadsheet, etiquette: "Excel" };
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return { icone: Presentation, etiquette: "PowerPoint" };
  if (mime.startsWith("image/")) return { icone: FileImage, etiquette: "Image" };
  if (mime.startsWith("text/")) return { icone: FileText, etiquette: "Texte" };
  return { icone: File, etiquette: "Fichier" };
}

function Ico({ de, size }: { de: LucideIcon; size: number }) {
  const Composant = de;
  return <Composant size={size} aria-hidden />;
}

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Stat({ icone, libelle, valeur }: { icone: LucideIcon; libelle: string; valeur: number | null }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Ico de={icone} size={20} />
      </span>
      <div>
        <p className="text-xs font-medium text-site-muted">{libelle}</p>
        {valeur === null ? (
          <Squelette className="mt-1.5 h-6 w-12" />
        ) : (
          <p className="font-display text-2xl font-bold leading-tight tabular-nums">{nombre.format(valeur)}</p>
        )}
      </div>
    </div>
  );
}

function BoutonIcone({
  libelle,
  onClick,
  disabled,
  danger,
  children,
}: {
  libelle: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors disabled:pointer-events-none disabled:opacity-40",
        danger ? "hover:bg-site-danger/10 hover:text-site-danger" : "hover:bg-site-surface2 hover:text-site-ink",
      )}
    >
      {children}
    </button>
  );
}

const COLONNES = "md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem]";

export function Documents() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("documents.gerer");
  const peutListerDepartements = profil.permissions.includes("utilisateurs.departements");

  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [categorieChoisie, setCategorieChoisie] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [formulaire, setFormulaire] = useState<{ doc: DocumentFichier | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentFichier | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

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

  const chargerCategories = useCallback(
    async (jeton: string) => {
      void version;
      return api<string[]>("/documents/categories", { token: jeton });
    },
    [version],
  );
  const cats = useDonnees(autorise, chargerCategories);
  const categories = useMemo(() => cats.donnees ?? [], [cats.donnees]);
  const categorie = cats.donnees === null || categories.includes(categorieChoisie) ? categorieChoisie : "";

  const chargerTotal = useCallback(
    async (jeton: string) => {
      void version;
      return (await api<{ total: number }>("/documents", { token: jeton })).total;
    },
    [version],
  );
  const total = useDonnees(autorise, chargerTotal);

  const cleCourante = `${page}|${q}|${categorie}|${version}`;
  const chargerListe = useCallback(
    async (jeton: string) => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set("q", q);
      if (categorie) p.set("categorie", categorie);
      const res = await api<Pagination<DocumentFichier>>(`/documents?${p.toString()}`, { token: jeton });
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [page, q, categorie, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;

  const chargerDepartements = useCallback(
    async (jeton: string) => api<DepartementOption[]>("/departements", { token: jeton }),
    [],
  );
  const deps = useDonnees(autorise && peutListerDepartements, chargerDepartements);
  const departements = useMemo<DepartementOption[]>(() => {
    if (deps.donnees) return deps.donnees;
    if (profil.departement_id) return [{ id: profil.departement_id, nom_departement: "Mon département" }];
    return [];
  }, [deps.donnees, profil.departement_id]);
  const nomDepartement = (id: number | null) =>
    departements.find((d) => d.id === id)?.nom_departement ?? "Un département";

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function apresEnregistrement(texte: string) {
    setFormulaire(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  }

  async function telecharger(d: DocumentFichier) {
    setEnCoursId(d.id);
    try {
      await telechargerFichier(`/documents/${d.id}/lien`, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCoursId(null);
    }
  }

  async function supprimer(d: DocumentFichier) {
    setASupprimer(null);
    setEnCoursId(d.id);
    try {
      await api<{ message: string }>(`/documents/${d.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: `Le document « ${d.nom_document} » a été supprimé.` });
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCoursId(null);
    }
  }

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Vous n’avez pas accès à la gestion des documents.
      </p>
    );
  }

  const filtre = q !== "" || categorie !== "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="mt-1 text-sm text-site-muted">
            Partagez des fichiers avec toute l’entreprise ou un département.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ doc: null })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Déposer un document
        </button>
      </div>

      {notice && (
        <p
          role={notice.type === "erreur" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok"
              ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
              : "border-site-danger/40 bg-site-danger/10 text-site-danger",
          )}
        >
          {notice.texte}
          <button
            type="button"
            aria-label="Masquer le message"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={16} aria-hidden />
          </button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icone={FolderOpen} libelle="Documents" valeur={total.donnees} />
        <Stat icone={Tags} libelle="Catégories" valeur={cats.donnees ? cats.donnees.length : null} />
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-site-line p-4">
          <div className="relative min-w-52 max-w-md flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted"
            />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Rechercher par nom"
              aria-label="Rechercher un document par nom"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
          <select
            value={categorie}
            onChange={(e) => {
              setCategorieChoisie(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par catégorie"
            className={cn(CHAMP, "w-auto min-w-44")}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {filtre && (
            <button
              type="button"
              onClick={() => {
                setSaisie("");
                setQ("");
                setCategorieChoisie("");
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
            <span>Impossible de charger les documents.</span>
            <button
              type="button"
              onClick={liste.reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : enChargement ? (
          <ul className="divide-y divide-site-line" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Squelette className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-56" />
                  <Squelette className="h-3 w-40" />
                </div>
              </li>
            ))}
          </ul>
        ) : !res || res.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <FolderOpen size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">
              {filtre ? "Aucun document ne correspond à cette recherche." : "Aucun document pour le moment."}
            </p>
            {!filtre && <p className="mt-1 text-xs text-site-muted">Déposez un premier fichier pour le partager.</p>}
          </div>
        ) : (
          <div>
            <div
              className={cn(
                "hidden gap-4 border-b border-site-line px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-site-muted md:grid",
                COLONNES,
              )}
            >
              <span>Document</span>
              <span>Destinataires</span>
              <span>Dépôt</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-site-line">
              {res.data.map((d) => {
                const occupe = enCoursId === d.id;
                const f = famille(d.type_mime);
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "grid items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-site-surface2/50",
                      COLONNES,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                        <Ico de={f.icone} size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{d.nom_document}</p>
                        <p className="truncate text-xs text-site-muted">
                          {f.etiquette} · {formaterTaille(d.taille_fichier)}
                        </p>
                        <span className="mt-1 inline-flex max-w-full rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                          <span className="truncate">{d.categorie}</span>
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 text-sm">
                      <p className="truncate">
                        {d.visibilite === "entreprise" ? "Toute l’entreprise" : nomDepartement(d.departement_id)}
                      </p>
                      {d.auteur && (
                        <p className="truncate text-xs text-site-muted">
                          Par {d.auteur.prenom} {d.auteur.nom}
                        </p>
                      )}
                    </div>

                    <div className="text-sm tabular-nums">{date.format(new Date(d.created_at))}</div>

                    <div className="flex items-center gap-1 md:justify-end">
                      <BoutonIcone
                        libelle={`Télécharger ${d.nom_document}`}
                        disabled={occupe}
                        onClick={() => telecharger(d)}
                      >
                        <Download size={16} aria-hidden />
                      </BoutonIcone>
                      <BoutonIcone
                        libelle={`Modifier ${d.nom_document}`}
                        disabled={occupe}
                        onClick={() => setFormulaire({ doc: d })}
                      >
                        <Pencil size={16} aria-hidden />
                      </BoutonIcone>
                      <BoutonIcone
                        libelle={`Supprimer ${d.nom_document}`}
                        danger
                        disabled={occupe}
                        onClick={() => setASupprimer(d)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </BoutonIcone>
                    </div>
                  </li>
                );
              })}
            </ul>

            {res.last_page > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-between gap-3 border-t border-site-line px-5 py-3"
              >
                <p className="text-xs text-site-muted">
                  Page {res.current_page} sur {res.last_page} · {nombre.format(res.total)} document
                  {res.total > 1 ? "s" : ""}
                </p>
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
              </nav>
            )}
          </div>
        )}
      </section>

      {formulaire && (
        <DocumentFormulaire
          doc={formulaire.doc}
          departements={departements}
          categories={categories}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aSupprimer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-suppression-doc"
        >
          <button
            type="button"
            aria-label="Annuler"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setASupprimer(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suppression-doc" className="font-display text-base font-semibold">
              Supprimer ce document ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">
              Le document « {aSupprimer.nom_document} » et son fichier seront supprimés définitivement. Cette action est
              irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setASupprimer(null)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => supprimer(aSupprimer)}
                className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

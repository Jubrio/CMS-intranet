"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, messageErreur, telechargerFichier } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { formaterTaille, type DocumentFichier } from "./document-formulaire";

// Documents en lecture seule : recherche, filtre par catégorie, téléchargement.
// L'API ne renvoie que les documents visibles par l'utilisateur (entreprise ou son département).

type Pagination<T> = { data: T[]; current_page: number; last_page: number; total: number };

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

// Famille du fichier d'après son type MIME : icône et étiquette
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

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

export function DocumentsConsultation() {
  const { token, expirer } = useEspace();
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [categorieChoisie, setCategorieChoisie] = useState("");
  const [page, setPage] = useState(1);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [erreurTelechargement, setErreurTelechargement] = useState<string | null>(null);

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!erreurTelechargement) return;
    const t = setTimeout(() => setErreurTelechargement(null), 6000);
    return () => clearTimeout(t);
  }, [erreurTelechargement]);

  const chargerCategories = useCallback(
    (jeton: string) => api<string[]>("/documents/categories", { token: jeton }),
    [],
  );
  const cats = useDonnees(true, chargerCategories);
  const categories = useMemo(() => cats.donnees ?? [], [cats.donnees]);
  // Une catégorie qui n'existe plus ne filtre plus
  const categorie = cats.donnees === null || categories.includes(categorieChoisie) ? categorieChoisie : "";

  const cleCourante = `${page}|${q}|${categorie}`;
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
  const liste = useDonnees(true, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;
  const filtre = q !== "" || categorie !== "";

  async function telecharger(d: DocumentFichier) {
    setEnCoursId(d.id);
    setErreurTelechargement(null);
    try {
      await telechargerFichier(`/documents/${d.id}/lien`, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setErreurTelechargement(messageErreur(err));
    } finally {
      setEnCoursId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Documents</h1>
        <p className="mt-1 text-sm text-site-muted">
          Les documents partagés avec vous : procédures, modèles, règlements…
        </p>
      </header>

      {erreurTelechargement && (
        <p
          role="alert"
          className="rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger"
        >
          {erreurTelechargement}
        </p>
      )}

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
              placeholder="Rechercher un document"
              aria-label="Rechercher un document"
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
                  <Squelette className="h-3.5 w-64 max-w-full" />
                  <Squelette className="h-3 w-32" />
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
              {filtre ? "Aucun document ne correspond à cette recherche." : "Aucun document partagé pour le moment."}
            </p>
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-site-line">
              {res.data.map((d) => {
                const f = famille(d.type_mime);
                const Icone = f.icone;
                const occupe = enCoursId === d.id;
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-site-surface2/50"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                      <Icone size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.nom_document}</p>
                      <p className="truncate text-xs text-site-muted">
                        {f.etiquette} · {formaterTaille(d.taille_fichier)} · {date.format(new Date(d.created_at))}
                        {d.auteur && ` · ${d.auteur.prenom} ${d.auteur.nom}`}
                      </p>
                      <span className="mt-1 inline-flex max-w-full rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                        <span className="truncate">{d.categorie}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => telecharger(d)}
                      disabled={occupe}
                      aria-label={`Télécharger ${d.nom_document}`}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-site-line px-4 text-sm font-medium transition-colors hover:border-brand-violet/60 disabled:opacity-60"
                    >
                      {occupe ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                      ) : (
                        <Download size={14} aria-hidden />
                      )}
                      Télécharger
                    </button>
                  </li>
                );
              })}
            </ul>

            {res.last_page > 1 && (
              <nav
                aria-label="Pagination"
                className="flex items-center justify-center gap-3 border-t border-site-line px-5 py-3 text-sm"
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={res.current_page <= 1}
                  aria-label="Page précédente"
                  className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40"
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="text-site-muted">
                  Page {res.current_page} sur {res.last_page}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(res.last_page, p + 1))}
                  disabled={res.current_page >= res.last_page}
                  aria-label="Page suivante"
                  className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </nav>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

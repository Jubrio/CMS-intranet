"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";
import type { DepartementOption } from "./contenu-formulaire";

export type DocumentFichier = {
  id: number;
  nom_document: string;
  categorie: string;
  visibilite: "entreprise" | "departement";
  departement_id: number | null;
  type_mime: string;
  taille_fichier: number; // en Ko
  auteur: { id: number; nom: string; prenom: string } | null;
  created_at: string;
};

export const EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "jpeg", "png"];
const MAX_KO = 10240;

export function formaterTaille(ko: number): string {
  if (ko >= 1024) return `${(ko / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  return `${ko.toLocaleString("fr-FR")} Ko`;
}

function Champ({ id, label, erreur, requis, aide, children }: { id: string; label: string; erreur?: string; requis?: boolean; aide?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-site-muted">
        {label}
        {requis && <span className="text-site-danger"> *</span>}
      </label>
      {children}
      {aide && !erreur && <p className="mt-1 text-[11px] text-site-muted">{aide}</p>}
      {erreur && <p className="mt-1 text-xs text-site-danger">{erreur}</p>}
    </div>
  );
}

type Props = {
  doc: DocumentFichier | null; // null = dépôt d'un nouveau document
  departements: DepartementOption[];
  categories: string[];
  onFermer: () => void;
  onEnregistre: (message: string) => void;
};

export function DocumentFormulaire({ doc, departements, categories, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = doc !== null;

  const [fichier, setFichier] = useState<File | null>(null);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);
  const [nom, setNom] = useState(doc?.nom_document ?? "");
  const [categorie, setCategorie] = useState(doc?.categorie ?? "");
  const [visibilite, setVisibilite] = useState<"entreprise" | "departement">(doc?.visibilite ?? "entreprise");
  const [departementId, setDepartementId] = useState(doc?.departement_id ? String(doc.departement_id) : "");
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    premierChamp.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = defilement;
    };
  }, [onFermer]);

  const err = (champ: string) => erreurs[champ]?.[0];

  function choisirFichier(f: File | null) {
    setErreurFichier(null);
    if (!f) {
      setFichier(null);
      return;
    }
    const extension = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONS.includes(extension)) {
      setFichier(null);
      setErreurFichier("Format non accepté. Formats possibles : PDF, Word, Excel, PowerPoint, texte, JPG ou PNG.");
      return;
    }
    if (f.size > MAX_KO * 1024) {
      setFichier(null);
      setErreurFichier("Fichier trop lourd : 10 Mo au maximum.");
      return;
    }
    setFichier(f);
    // Le nom du document reprend celui du fichier tant que l'utilisateur n'en a pas saisi un
    if (!nom.trim()) setNom(f.name.replace(/\.[^.]+$/, "").slice(0, 150));
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setErreurs({});
    setMessage(null);

    if (!edition && !fichier) {
      setErreurFichier("Choisissez un fichier à déposer.");
      return;
    }

    setEnvoi(true);
    const departement = visibilite === "departement" && departementId ? Number(departementId) : null;

    try {
      if (edition) {
        await api<DocumentFichier>(`/documents/${doc.id}`, {
          method: "PUT",
          token,
          body: JSON.stringify({ nom_document: nom.trim(), categorie: categorie.trim(), visibilite, departement_id: departement }),
        });
        onEnregistre("Document modifié.");
      } else {
        const corps = new FormData();
        corps.append("fichier", fichier as File);
        if (nom.trim()) corps.append("nom_document", nom.trim());
        corps.append("categorie", categorie.trim());
        corps.append("visibilite", visibilite);
        if (departement !== null) corps.append("departement_id", String(departement));
        await api<DocumentFichier>("/documents", { method: "POST", token, body: corps });
        onEnregistre("Document déposé.");
      }
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 401) {
        expirer();
        return;
      }
      if (e2 instanceof ApiError && e2.errors) {
        setErreurs(e2.errors);
        setMessage("Certains champs sont à corriger.");
      } else {
        setMessage(messageErreur(e2));
      }
      setEnvoi(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-doc">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <form onSubmit={soumettre} noValidate className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-formulaire-doc" className="font-display text-base font-semibold">
            {edition ? "Modifier le document" : "Déposer un document"}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {message && (
            <p role="alert" className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger">
              {message}
            </p>
          )}

          {!edition && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-site-muted">
                Fichier<span className="text-site-danger"> *</span>
              </span>
              <input
                id="doc-fichier"
                type="file"
                className="sr-only"
                accept={EXTENSIONS.map((x) => `.${x}`).join(",")}
                onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
              />
              <label
                htmlFor="doc-fichier"
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:border-brand-violet/60 focus-within:ring-2 focus-within:ring-brand-violet/30",
                  erreurFichier || err("fichier") ? "border-site-danger/60" : "border-site-line",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                  <FileUp size={20} aria-hidden />
                </span>
                {fichier ? (
                  <>
                    <span className="max-w-full truncate text-sm font-medium">{fichier.name}</span>
                    <span className="text-xs text-site-muted">{formaterTaille(Math.ceil(fichier.size / 1024))} · cliquez pour changer</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">Choisir un fichier</span>
                    <span className="text-xs text-site-muted">PDF, Word, Excel, PowerPoint, texte, JPG ou PNG · 10 Mo au maximum</span>
                  </>
                )}
              </label>
              {(erreurFichier || err("fichier")) && <p className="mt-1 text-xs text-site-danger">{erreurFichier ?? err("fichier")}</p>}
            </div>
          )}

          <Champ id="doc-nom" label="Nom du document" erreur={err("nom_document")} aide={edition ? undefined : "Facultatif : le nom du fichier est utilisé par défaut."}>
            <input id="doc-nom" ref={premierChamp} className={CHAMP} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={150} autoComplete="off" />
          </Champ>

          <Champ id="doc-cat" label="Catégorie" requis erreur={err("categorie")} aide="Choisissez une catégorie existante ou saisissez-en une nouvelle.">
            <input id="doc-cat" list="doc-categories" className={CHAMP} value={categorie} onChange={(e) => setCategorie(e.target.value)} maxLength={50} autoComplete="off" />
            <datalist id="doc-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Champ>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ id="doc-visi" label="Destinataires" requis erreur={err("visibilite")}>
              <select id="doc-visi" className={CHAMP} value={visibilite} onChange={(e) => setVisibilite(e.target.value as "entreprise" | "departement")}>
                <option value="entreprise">Toute l’entreprise</option>
                <option value="departement">Un département</option>
              </select>
            </Champ>

            {visibilite === "departement" && (
              <Champ id="doc-dep" label="Département" requis erreur={err("departement_id")}>
                <select id="doc-dep" className={CHAMP} value={departementId} onChange={(e) => setDepartementId(e.target.value)}>
                  <option value="">{departements.length === 0 ? "Aucun département disponible" : "Choisir…"}</option>
                  {departements.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom_departement}
                    </option>
                  ))}
                </select>
              </Champ>
            )}
          </div>

          {edition && <p className="text-[11px] text-site-muted">Le fichier lui-même ne peut pas être remplacé : supprimez ce document et déposez-en un nouveau.</p>}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-site-line px-5 py-4">
          <button
            type="button"
            onClick={onFermer}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={envoi}
            className={cn("v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold", envoi && "opacity-70")}
          >
            {envoi && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {edition ? "Enregistrer" : "Déposer"}
          </button>
        </footer>
      </form>
    </div>
  );
}

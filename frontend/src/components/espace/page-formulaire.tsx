"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";
import type { DepartementOption } from "./contenu-formulaire";

export type StatutPage = "brouillon" | "publie" | "archive";

export type PageInterne = {
  id: number;
  titre: string;
  visibilite: "entreprise" | "departement";
  departement_id: number | null;
  statut_contenu: StatutPage;
  emplacement_menu: string | null;
  date_publication: string | null;
  auteur: { id: number; nom: string; prenom: string } | null;
  corps?: string;
  images?: ImagePage[];
};

type ImagePage = {
  id: number;
  nom_image: string;
  texte_alternatif: string | null;
  type_mime: string;
  taille_ko: number;
  url: string;
};

const MAX_IMAGES = 10; // RG39
const MAX_KO = 5120;
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];

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

// Images de la page : ajout et suppression directs (la page doit déjà exister)
function Images({ pageId, images, onChange }: { pageId: number; images: ImagePage[]; onChange: (liste: ImagePage[]) => void }) {
  const { token, expirer } = useEspace();
  const [alt, setAlt] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [suppressionId, setSuppressionId] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const entree = useRef<HTMLInputElement>(null);
  const pleine = images.length >= MAX_IMAGES;

  async function ajouter(fichier: File) {
    setErreur(null);
    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      setErreur("Format non accepté : utilisez une image JPG, PNG ou WebP.");
      return;
    }
    if (fichier.size > MAX_KO * 1024) {
      setErreur("Image trop lourde : 5 Mo au maximum.");
      return;
    }
    setEnvoi(true);
    const corps = new FormData();
    corps.append("image", fichier);
    if (alt.trim()) corps.append("texte_alternatif", alt.trim());
    try {
      const image = await api<ImagePage>(`/pages/${pageId}/images`, { method: "POST", token, body: corps });
      onChange([...images, image]);
      setAlt("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return;
      }
      setErreur(e instanceof ApiError && e.errors ? Object.values(e.errors)[0]?.[0] ?? messageErreur(e) : messageErreur(e));
    } finally {
      setEnvoi(false);
      if (entree.current) entree.current.value = "";
    }
  }

  async function retirer(image: ImagePage) {
    setErreur(null);
    setSuppressionId(image.id);
    try {
      await api<{ message: string }>(`/pages/${pageId}/images/${image.id}`, { method: "DELETE", token });
      onChange(images.filter((i) => i.id !== image.id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return;
      }
      setErreur(messageErreur(e));
    } finally {
      setSuppressionId(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium text-site-muted">Images</h3>
        <span className="text-xs tabular-nums text-site-muted">
          {images.length} / {MAX_IMAGES}
        </span>
      </div>

      {images.length > 0 && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((i) => (
            <li key={i.id} className="group relative overflow-hidden rounded-xl border border-site-line bg-site-base/40">
              {/* Adresse signée temporaire : next/image n'est pas adapté */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={i.texte_alternatif ?? i.nom_image} className="aspect-video w-full object-cover" loading="lazy" />
              <div className="flex items-center gap-2 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-site-muted" title={i.texte_alternatif ? `${i.nom_image} — ${i.texte_alternatif}` : i.nom_image}>
                  {i.nom_image}
                </span>
                <button
                  type="button"
                  onClick={() => retirer(i)}
                  disabled={suppressionId === i.id}
                  aria-label={`Supprimer l’image ${i.nom_image}`}
                  title="Supprimer l’image"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-site-muted transition-colors hover:bg-site-danger/10 hover:text-site-danger disabled:opacity-50"
                >
                  {suppressionId === i.id ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-xl border border-dashed border-site-line p-3">
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          maxLength={200}
          placeholder="Texte alternatif de la prochaine image (facultatif)"
          aria-label="Texte alternatif de la prochaine image"
          disabled={pleine || envoi}
          className={CHAMP}
        />
        <input
          ref={entree}
          id="p-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={pleine || envoi}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void ajouter(f);
          }}
        />
        <label
          htmlFor="p-image"
          className={cn(
            "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-site-line px-4 text-sm font-semibold transition-colors hover:border-brand-violet/60 focus-within:ring-2 focus-within:ring-brand-violet/30",
            (pleine || envoi) && "pointer-events-none opacity-60",
          )}
        >
          {envoi ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
          {pleine ? "Limite atteinte" : "Ajouter une image"}
        </label>
        <p className="text-[11px] text-site-muted">JPG, PNG ou WebP, 5 Mo au maximum, {MAX_IMAGES} images par page.</p>
        {erreur && (
          <p role="alert" className="text-xs text-site-danger">
            {erreur}
          </p>
        )}
      </div>
    </div>
  );
}

type Props = {
  page: PageInterne | null; // null = création
  departements: DepartementOption[];
  onFermer: () => void;
  // `rouvrir` : page tout juste créée en brouillon, à rouvrir pour y ajouter des images
  onEnregistre: (message: string, options?: { echecPublication?: string; rouvrir?: PageInterne }) => void;
};

export function PageFormulaire({ page, departements, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = page !== null;
  const dejaPubliee = page?.statut_contenu === "publie";

  const [titre, setTitre] = useState(page?.titre ?? "");
  const [emplacement, setEmplacement] = useState(page?.emplacement_menu ?? "");
  const [corps, setCorps] = useState("");
  const [images, setImages] = useState<ImagePage[]>([]);
  const [visibilite, setVisibilite] = useState<"entreprise" | "departement">(page?.visibilite ?? "entreprise");
  const [departementId, setDepartementId] = useState(page?.departement_id ? String(page.departement_id) : "");
  const [chargement, setChargement] = useState(edition);
  const [echecChargement, setEchecChargement] = useState(false);
  const [envoi, setEnvoi] = useState<"enregistrer" | "publier" | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  // Le corps complet et les images ne sont pas dans la liste
  const pageId = page?.id ?? null;
  useEffect(() => {
    if (pageId === null) return;
    let annule = false;
    api<PageInterne>(`/pages/${pageId}`, { token })
      .then((d) => {
        if (annule) return;
        setCorps(d.corps ?? "");
        setImages(d.images ?? []);
        setChargement(false);
      })
      .catch((e) => {
        if (annule) return;
        if (e instanceof ApiError && e.status === 401) {
          expirer();
          return;
        }
        setMessage(messageErreur(e));
        setEchecChargement(true);
        setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [pageId, token, expirer]);

  useEffect(() => {
    if (!chargement) premierChamp.current?.focus();
  }, [chargement]);

  useEffect(() => {
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

  async function soumettre(publier: boolean) {
    if (envoi || chargement || echecChargement) return;
    setEnvoi(publier ? "publier" : "enregistrer");
    setErreurs({});
    setMessage(null);

    const corpsEnvoye = {
      titre: titre.trim(),
      corps,
      emplacement_menu: emplacement.trim() || null,
      visibilite,
      departement_id: visibilite === "departement" && departementId ? Number(departementId) : null,
    };

    let creee: PageInterne | null = null;
    try {
      if (edition) {
        await api<PageInterne>(`/pages/${page.id}`, { method: "PUT", token, body: JSON.stringify(corpsEnvoye) });
      } else {
        // À la création, le statut peut être fixé directement
        creee = await api<PageInterne>("/pages", {
          method: "POST",
          token,
          body: JSON.stringify({ ...corpsEnvoye, statut_contenu: publier ? "publie" : "brouillon" }),
        });
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
      setEnvoi(null);
      return;
    }

    // Création : tout est fait. Brouillon : on rouvre la page pour permettre l'ajout d'images.
    if (creee) {
      if (publier) onEnregistre("Page publiée.");
      else onEnregistre("Page enregistrée en brouillon. Vous pouvez maintenant y ajouter des images.", { rouvrir: creee });
      return;
    }

    if (!publier || dejaPubliee) {
      onEnregistre("Page modifiée.");
      return;
    }

    try {
      await api<PageInterne>(`/pages/${page!.id}/publier`, { method: "POST", token });
      onEnregistre("Page publiée.");
    } catch (e3) {
      if (e3 instanceof ApiError && e3.status === 401) {
        expirer();
        return;
      }
      onEnregistre("Page modifiée.", { echecPublication: messageErreur(e3) });
    }
  }

  const occupe = envoi !== null || chargement;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-page">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void soumettre(false);
        }}
        noValidate
        className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-site-line bg-site-surface shadow-2xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-formulaire-page" className="font-display text-base font-semibold">
            {edition ? "Modifier la page" : "Nouvelle page"}
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

          {chargement ? (
            <div aria-hidden className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-site-line" />
              <div className="h-10 animate-pulse rounded-lg bg-site-line" />
              <div className="h-48 animate-pulse rounded-lg bg-site-line/70" />
            </div>
          ) : echecChargement ? null : (
            <>
              <Champ id="p-titre" label="Titre" requis erreur={err("titre")}>
                <input id="p-titre" ref={premierChamp} className={CHAMP} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={150} autoComplete="off" />
              </Champ>

              <Champ
                id="p-emplacement"
                label="Rubrique du menu"
                erreur={err("emplacement_menu")}
                aide="Les pages sont rangées par rubrique dans le menu de l’intranet. Sans rubrique, la page est classée sous « Pages »."
              >
                <input id="p-emplacement" className={CHAMP} value={emplacement} onChange={(e) => setEmplacement(e.target.value)} maxLength={50} autoComplete="off" />
              </Champ>

              <div className="grid gap-4 sm:grid-cols-2">
                <Champ id="p-visi" label="Destinataires" requis erreur={err("visibilite")}>
                  <select id="p-visi" className={CHAMP} value={visibilite} onChange={(e) => setVisibilite(e.target.value as "entreprise" | "departement")}>
                    <option value="entreprise">Toute l’entreprise</option>
                    <option value="departement">Un département</option>
                  </select>
                </Champ>

                {visibilite === "departement" && (
                  <Champ id="p-dep" label="Département" requis erreur={err("departement_id")}>
                    <select id="p-dep" className={CHAMP} value={departementId} onChange={(e) => setDepartementId(e.target.value)}>
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

              <Champ id="p-corps" label="Contenu" requis erreur={err("corps")}>
                <textarea id="p-corps" rows={12} value={corps} onChange={(e) => setCorps(e.target.value)} maxLength={100000} className={cn(CHAMP, "h-auto resize-y py-2 leading-relaxed")} />
              </Champ>

              {edition ? (
                <Images pageId={page.id} images={images} onChange={setImages} />
              ) : (
                <p className="rounded-lg border border-dashed border-site-line px-3 py-2.5 text-xs text-site-muted">
                  Les images peuvent être ajoutées une fois la page enregistrée en brouillon.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-site-line px-5 py-4">
          <button
            type="button"
            onClick={onFermer}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={occupe || echecChargement}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold",
              dejaPubliee ? "v-gradient-btn" : "border border-site-line text-site-ink transition-colors hover:border-brand-violet/60",
              (occupe || echecChargement) && "opacity-70",
            )}
          >
            {envoi === "enregistrer" && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {dejaPubliee || edition ? "Enregistrer" : "Enregistrer en brouillon"}
          </button>
          {!dejaPubliee && (
            <button
              type="button"
              disabled={occupe || echecChargement}
              onClick={() => void soumettre(true)}
              className={cn("v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold", (occupe || echecChargement) && "opacity-70")}
            >
              {envoi === "publier" && <Loader2 size={16} className="animate-spin" aria-hidden />}
              Enregistrer et publier
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

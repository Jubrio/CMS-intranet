"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";
import type { ImageContenu } from "./lecteur-contenu";

// Images d'une actualité, d'une annonce ou d'un article : elles s'affichent dans le fil d'accueil.
// Ajout et suppression directs : la publication doit déjà exister (enregistrée en brouillon).

const MAX_IMAGES = 6;
const MAX_KO = 5120;
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];

export function ImagesContenu({
  type,
  contenuId,
  images,
  onChange,
}: {
  type: "actualite" | "annonce" | "article";
  contenuId: number;
  images: ImageContenu[];
  onChange: (liste: ImageContenu[]) => void;
}) {
  const { token, expirer } = useEspace();
  const idChamp = useId();
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
      const image = await api<ImageContenu>(`/contenus/${type}/${contenuId}/images`, { method: "POST", token, body: corps });
      onChange([...images, image]);
      setAlt("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return;
      }
      setErreur(e instanceof ApiError && e.errors ? (Object.values(e.errors)[0]?.[0] ?? messageErreur(e)) : messageErreur(e));
    } finally {
      setEnvoi(false);
      if (entree.current) entree.current.value = "";
    }
  }

  async function retirer(image: ImageContenu) {
    setErreur(null);
    setSuppressionId(image.id);
    try {
      await api<{ message: string }>(`/contenus/${type}/${contenuId}/images/${image.id}`, { method: "DELETE", token });
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
            <li key={i.id} className="overflow-hidden rounded-xl border border-site-line bg-site-base/40">
              {/* Adresse signée temporaire : next/image n'est pas adapté */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={i.texte_alternatif ?? i.nom_image} className="aspect-video w-full object-cover" loading="lazy" />
              <div className="flex items-center gap-2 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-site-muted" title={i.nom_image}>
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
          id={idChamp}
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
          htmlFor={idChamp}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-site-line px-4 text-sm font-semibold transition-colors hover:border-brand-violet/60 focus-within:ring-2 focus-within:ring-brand-violet/30",
            (pleine || envoi) && "pointer-events-none opacity-60",
          )}
        >
          {envoi ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
          {pleine ? "Limite atteinte" : "Ajouter une image"}
        </label>
        <p className="text-[11px] text-site-muted">JPG, PNG ou WebP, 5 Mo au maximum, {MAX_IMAGES} images par publication.</p>
        {erreur && (
          <p role="alert" className="text-xs text-site-danger">
            {erreur}
          </p>
        )}
      </div>
    </div>
  );
}

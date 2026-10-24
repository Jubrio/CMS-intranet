"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BookCheck, CheckCircle2, FileText, Megaphone, Newspaper, ScrollText, X, type LucideIcon } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";

// Panneau de lecture d'une publication (actualité, annonce, article, note de service),
// avec ses images et, pour une note de service, la confirmation de lecture (RG24).
// Partagé par le fil d'accueil et le tableau de bord de l'employé.

export type TypeContenu = "actualite" | "annonce" | "article" | "note_service";
export type Ouvert = { type: TypeContenu; id: number; titre: string };

export const ICONES_TYPE: Record<TypeContenu, LucideIcon> = {
  actualite: Newspaper,
  annonce: Megaphone,
  article: FileText,
  note_service: ScrollText,
};

export type ImageContenu = { id: number; nom_image: string; texte_alternatif: string | null; url: string };

type Detail = {
  id: number;
  type_contenu: TypeContenu;
  titre: string;
  corps: string;
  categorie: string | null;
  numero_note: string | null;
  date_publication: string | null;
  date_expiration: string | null;
  auteur: { id: number; nom: string; prenom: string } | null;
  images?: ImageContenu[];
  lu?: boolean;
  date_lecture?: string | null;
};

const nomComplet = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`;

const BOUTON_PETIT =
  "inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50";

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

export function LecteurContenu({ ouvert, onFermer, onLu }: { ouvert: Ouvert; onFermer: () => void; onLu: () => void }) {
  const { token } = useEspace();
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [luLocal, setLuLocal] = useState(false);

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

  const charger = useCallback(
    (jeton: string) => api<Detail>(`/contenus/${ouvert.type}/${ouvert.id}`, { token: jeton }),
    [ouvert],
  );
  const { donnees: c, chargement, erreur, reessayer } = useDonnees(true, charger);

  const estNote = ouvert.type === "note_service";
  const lu = luLocal || c?.lu === true;
  const Icone = ICONES_TYPE[ouvert.type];

  async function confirmer() {
    setEnvoi(true);
    setMessage(null);
    try {
      await api(`/contenus/note_service/${ouvert.id}/lecture`, { method: "POST", token });
      setLuLocal(true);
      onLu();
    } catch (err) {
      setMessage(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-lecteur">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-site-line px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
              <Icone size={17} aria-hidden />
            </span>
            <h2 id="titre-lecteur" className="truncate font-display text-base font-semibold">
              {c?.titre ?? ouvert.titre}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {erreur ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-site-muted">
              <span>Impossible de charger ce contenu.</span>
              <button type="button" onClick={reessayer} className={BOUTON_PETIT}>
                Réessayer
              </button>
            </div>
          ) : chargement || !c ? (
            <div className="space-y-3">
              <Squelette className="h-4 w-48" />
              <Squelette className="h-3.5 w-full" />
              <Squelette className="h-3.5 w-full" />
              <Squelette className="h-3.5 w-2/3" />
            </div>
          ) : (
            <>
              <p className="text-xs text-site-muted">
                {[
                  c.numero_note ? `Note n° ${c.numero_note}` : null,
                  c.categorie,
                  c.auteur ? `Par ${nomComplet(c.auteur)}` : null,
                  c.date_publication ? format(new Date(c.date_publication), "d MMMM yyyy", { locale: fr }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {c.date_expiration && (
                <p className="text-xs text-site-muted">
                  Valable jusqu&apos;au {format(parseISO(c.date_expiration), "d MMMM yyyy", { locale: fr })}.
                </p>
              )}
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{c.corps}</div>
              {c.images && c.images.length > 0 && (
                <ul className="space-y-3">
                  {c.images.map((i) => (
                    <li key={i.id} className="overflow-hidden rounded-xl border border-site-line">
                      {/* Adresse signée temporaire : next/image n'est pas adapté */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={i.url}
                        alt={i.texte_alternatif ?? i.nom_image}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {estNote && c && (
          <footer className="shrink-0 border-t border-site-line px-5 py-4">
            {lu ? (
              <p className="flex items-center gap-2 text-sm font-medium text-brand-cyan">
                <CheckCircle2 size={17} aria-hidden /> Lecture confirmée
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={confirmer}
                  disabled={envoi}
                  className="v-gradient-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                >
                  <BookCheck size={16} aria-hidden /> {envoi ? "Envoi…" : "Confirmer la lecture"}
                </button>
                {message && (
                  <span role="alert" className="text-xs text-site-danger">
                    {message}
                  </span>
                )}
              </div>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";

export type QuestionFaq = {
  id: number;
  question: string;
  reponse: string;
  categorie: string;
  auteur: { id: number; nom: string; prenom: string } | null;
  updated_at: string;
};

export type CategorieFaq = { categorie: string; nb_questions: number };

function Champ({
  id,
  label,
  erreur,
  requis,
  aide,
  children,
}: {
  id: string;
  label: string;
  erreur?: string;
  requis?: boolean;
  aide?: string;
  children: ReactNode;
}) {
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
  question: QuestionFaq | null; // null = création
  categories: string[];
  categorieParDefaut: string;
  onFermer: () => void;
  onEnregistre: (message: string) => void;
};

export function FaqFormulaire({ question: existante, categories, categorieParDefaut, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = existante !== null;

  const [categorie, setCategorie] = useState(existante?.categorie ?? categorieParDefaut);
  const [question, setQuestion] = useState(existante?.question ?? "");
  const [reponse, setReponse] = useState(existante?.reponse ?? "");
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

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    setErreurs({});
    setMessage(null);

    try {
      await api<QuestionFaq>(edition ? `/faq/${existante.id}` : "/faq", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify({ categorie: categorie.trim(), question: question.trim(), reponse }),
      });
      onEnregistre(edition ? "Question modifiée." : "Question ajoutée.");
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
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-faq">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <form
        onSubmit={soumettre}
        noValidate
        className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-formulaire-faq" className="font-display text-base font-semibold">
            {edition ? "Modifier la question" : "Nouvelle question"}
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
            <p
              role="alert"
              className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger"
            >
              {message}
            </p>
          )}

          <Champ
            id="f-cat"
            label="Catégorie"
            requis
            erreur={err("categorie")}
            aide="Choisissez une catégorie existante ou saisissez-en une nouvelle."
          >
            <input
              id="f-cat"
              ref={premierChamp}
              list="faq-categories"
              className={CHAMP}
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              maxLength={50}
              autoComplete="off"
            />
            <datalist id="faq-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Champ>

          <Champ id="f-question" label="Question" requis erreur={err("question")} aide={`${question.length} / 250`}>
            <textarea
              id="f-question"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={250}
              className={cn(CHAMP, "h-auto resize-y py-2")}
            />
          </Champ>

          <Champ id="f-reponse" label="Réponse" requis erreur={err("reponse")}>
            <textarea
              id="f-reponse"
              rows={10}
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              className={cn(CHAMP, "h-auto resize-y py-2 leading-relaxed")}
            />
          </Champ>
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
            className={cn(
              "v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold",
              envoi && "opacity-70",
            )}
          >
            {envoi && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {edition ? "Enregistrer" : "Ajouter la question"}
          </button>
        </footer>
      </form>
    </div>
  );
}

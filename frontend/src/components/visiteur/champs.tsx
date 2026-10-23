"use client";

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

export const classeChamp =
  "w-full rounded-xl border border-site-line bg-site-base px-4 py-3 text-sm text-site-ink outline-none transition placeholder:text-site-muted/70 focus:border-brand-violet focus:ring-2 focus:ring-brand-violet/30 aria-[invalid=true]:border-site-danger";

type ChampProps = {
  id: string;
  label: string;
  erreur?: string;
  aide?: string;
  children: ReactNode;
};

// Étiquette + contrôle + message d'erreur, reliés pour les lecteurs d'écran
export function Champ({ id, label, erreur, aide, children }: ChampProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {aide && !erreur && (
        <p id={`${id}-aide`} className="mt-1.5 text-xs text-site-muted">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="mt-1.5 text-xs font-medium text-site-danger">
          {erreur}
        </p>
      )}
    </div>
  );
}

type SaisieProps = InputHTMLAttributes<HTMLInputElement> & { id: string; erreur?: string; aide?: boolean };

export const Saisie = forwardRef<HTMLInputElement, SaisieProps>(function Saisie(
  { id, erreur, aide, className = "", ...props },
  ref,
) {
  const decrit = erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={erreur ? true : undefined}
      aria-describedby={decrit}
      className={`${classeChamp} ${className}`}
      {...props}
    />
  );
});

export const SaisieMotDePasse = forwardRef<HTMLInputElement, SaisieProps>(function SaisieMotDePasse(
  { className = "", ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Saisie ref={ref} type={visible ? "text" : "password"} className={`pr-12 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-site-muted transition-colors hover:text-site-ink"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
});

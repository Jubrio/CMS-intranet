"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import type { Personnalisation } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";

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

function FormulaireParametres({ initial }: { initial: Personnalisation }) {
  const { token, expirer, majPerso } = useEspace();

  const [base, setBase] = useState(initial);
  const [nom, setNom] = useState(initial.nom_entreprise);
  const [email, setEmail] = useState(initial.email_contact ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  const err = (champ: string) => erreurs[champ]?.[0];
  const modifie = nom.trim() !== base.nom_entreprise || email.trim() !== (base.email_contact ?? "");

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi || !modifie) return;
    setErreurs({});
    setNotice(null);

    if (!nom.trim()) {
      setErreurs({ nom_entreprise: ["Le nom de l’entreprise est obligatoire."] });
      setNotice({ type: "erreur", texte: "Certains champs sont à corriger." });
      return;
    }

    setEnvoi(true);
    try {
      const res = await api<Personnalisation>("/entreprise", {
        method: "PUT",
        token,
        body: JSON.stringify({ nom_entreprise: nom.trim(), email_contact: email.trim() || null }),
      });
      setBase(res);
      setNom(res.nom_entreprise);
      setEmail(res.email_contact ?? "");
      majPerso(res);
      setNotice({ type: "ok", texte: "Les paramètres sont enregistrés." });
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 401) {
        expirer();
        return;
      }
      if (e2 instanceof ApiError && e2.errors) {
        setErreurs(e2.errors);
        setNotice({ type: "erreur", texte: "Certains champs sont à corriger." });
      } else {
        setNotice({ type: "erreur", texte: messageErreur(e2) });
      }
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="space-y-6">
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

      <section className="max-w-2xl space-y-5 rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm">
        <div>
          <h2 className="font-display text-sm font-semibold">Informations de l’entreprise</h2>
          <p className="mt-1 text-xs text-site-muted">
            Le nom s’affiche en haut du menu et dans l’en-tête de l’espace.
          </p>
        </div>

        <Champ
          id="p-nom"
          label="Nom de l’entreprise"
          requis
          erreur={err("nom_entreprise")}
          aide={`${nom.length} / 100`}
        >
          <input
            id="p-nom"
            className={CHAMP}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={100}
            autoComplete="organization"
          />
        </Champ>

        <Champ
          id="p-email"
          label="E-mail de contact"
          erreur={err("email_contact")}
          aide="Facultatif. Adresse à laquelle vos équipes peuvent joindre l’entreprise."
        >
          <input
            id="p-email"
            type="email"
            className={CHAMP}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={100}
            autoComplete="email"
          />
        </Champ>

        <Champ
          id="p-slug"
          label="Identifiant de l’intranet"
          aide="Défini à la création de l’intranet, il ne peut pas être modifié."
        >
          <input id="p-slug" className={cn(CHAMP, "font-mono")} value={base.slug} readOnly />
        </Champ>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-site-line pt-4">
          <button
            type="button"
            onClick={() => {
              setNom(base.nom_entreprise);
              setEmail(base.email_contact ?? "");
              setErreurs({});
            }}
            disabled={!modifie || envoi}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
          >
            Annuler les modifications
          </button>
          <button
            type="submit"
            disabled={!modifie || envoi}
            className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50"
          >
            {envoi && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Enregistrer
          </button>
        </div>
      </section>
    </form>
  );
}

export function Parametres() {
  const { profil } = useEspace();
  const autorise = profil.permissions.includes("personnalisation.parametres");

  const charger = useCallback((jeton: string) => api<Personnalisation>("/personnalisation", { token: jeton }), []);
  const { donnees, erreur, reessayer } = useDonnees(autorise, charger);

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Vous n’avez pas accès aux paramètres de l’entreprise.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Paramètres</h1>
        <p className="mt-1 text-sm text-site-muted">Gérez les informations générales de votre entreprise.</p>
      </div>

      {erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted shadow-sm">
          <span>Impossible de charger les paramètres.</span>
          <button
            type="button"
            onClick={reessayer}
            className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            Réessayer
          </button>
        </div>
      ) : donnees === null ? (
        <div className="h-80 max-w-2xl animate-pulse rounded-2xl bg-site-line" aria-hidden />
      ) : (
        <FormulaireParametres initial={donnees} />
      )}
    </div>
  );
}

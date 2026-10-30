"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";

export type Utilisateur = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  photo?: string | null;
  poste: string | null;
  date_embauche: string | null;
  statut_compte: "actif" | "inactif";
  role_id: number;
  role: string | null;
  departement_id: number | null;
  superieur_id: number | null;
};

export type RoleOption = { id: number; nom_role: string };
export type DepartementOption = { id: number; nom_departement: string };

export const CHAMP =
  "h-10 w-full rounded-lg border border-site-line bg-site-base/60 px-3 text-sm text-site-ink outline-none transition-colors placeholder:text-site-muted/70 focus:border-brand-violet focus-visible:ring-2 focus-visible:ring-brand-violet/30 disabled:opacity-60";

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
      {erreur && (
        <p id={`${id}-erreur`} className="mt-1 text-xs text-site-danger">
          {erreur}
        </p>
      )}
    </div>
  );
}

type Props = {
  utilisateur: Utilisateur | null; // null = création
  roles: RoleOption[];
  departements: DepartementOption[];
  onFermer: () => void;
  onEnregistre: (message: string) => void;
};

export function UtilisateurFormulaire({ utilisateur, roles, departements, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = utilisateur !== null;

  const [valeurs, setValeurs] = useState({
    prenom: utilisateur?.prenom ?? "",
    nom: utilisateur?.nom ?? "",
    email: utilisateur?.email ?? "",
    mot_de_passe: "",
    role_id: utilisateur ? String(utilisateur.role_id) : "",
    departement_id: utilisateur?.departement_id ? String(utilisateur.departement_id) : "",
    poste: utilisateur?.poste ?? "",
    telephone: utilisateur?.telephone ?? "",
    date_embauche: utilisateur?.date_embauche ? utilisateur.date_embauche.slice(0, 10) : "",
  });
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

  const maj = (champ: keyof typeof valeurs) => (e: { target: { value: string } }) =>
    setValeurs((v) => ({ ...v, [champ]: e.target.value }));
  const err = (champ: string) => erreurs[champ]?.[0];

  // Le rôle actuel du compte peut ne pas être attribuable par l'appelant : on l'affiche quand même
  const rolesAffiches =
    utilisateur && !roles.some((r) => r.id === utilisateur.role_id)
      ? [{ id: utilisateur.role_id, nom_role: utilisateur.role ?? "Rôle actuel" }, ...roles]
      : roles;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    setErreurs({});
    setMessage(null);

    const corps: Record<string, unknown> = {
      prenom: valeurs.prenom.trim(),
      nom: valeurs.nom.trim(),
      email: valeurs.email.trim(),
      role_id: valeurs.role_id ? Number(valeurs.role_id) : null,
      departement_id: valeurs.departement_id ? Number(valeurs.departement_id) : null,
      poste: valeurs.poste.trim() || null,
      telephone: valeurs.telephone.trim() || null,
      date_embauche: valeurs.date_embauche || null,
    };
    if (!edition || valeurs.mot_de_passe) corps.mot_de_passe = valeurs.mot_de_passe;

    try {
      await api<Utilisateur>(edition ? `/utilisateurs/${utilisateur.id}` : "/utilisateurs", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify(corps),
      });
      onEnregistre(edition ? "Modifications enregistrées." : "Utilisateur créé.");
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
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire">
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
          <h2 id="titre-formulaire" className="font-display text-base font-semibold">
            {edition ? "Modifier l’utilisateur" : "Nouvel utilisateur"}
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

          <div className="grid grid-cols-2 gap-3">
            <Champ id="f-prenom" label="Prénom" requis erreur={err("prenom")}>
              <input
                id="f-prenom"
                ref={premierChamp}
                className={CHAMP}
                value={valeurs.prenom}
                onChange={maj("prenom")}
                maxLength={100}
                autoComplete="off"
              />
            </Champ>
            <Champ id="f-nom" label="Nom" requis erreur={err("nom")}>
              <input
                id="f-nom"
                className={CHAMP}
                value={valeurs.nom}
                onChange={maj("nom")}
                maxLength={100}
                autoComplete="off"
              />
            </Champ>
          </div>

          <Champ id="f-email" label="Adresse e-mail" requis erreur={err("email")}>
            <input
              id="f-email"
              type="email"
              className={CHAMP}
              value={valeurs.email}
              onChange={maj("email")}
              maxLength={255}
              autoComplete="off"
            />
          </Champ>

          <Champ
            id="f-mdp"
            label={edition ? "Nouveau mot de passe" : "Mot de passe"}
            requis={!edition}
            erreur={err("mot_de_passe")}
            aide={edition ? "Laissez vide pour conserver le mot de passe actuel." : "10 caractères minimum, avec des lettres et des chiffres."}
          >
            <input
              id="f-mdp"
              type="password"
              className={CHAMP}
              value={valeurs.mot_de_passe}
              onChange={maj("mot_de_passe")}
              maxLength={72}
              autoComplete="new-password"
            />
          </Champ>

          <div className="grid grid-cols-2 gap-3">
            <Champ id="f-role" label="Rôle" requis erreur={err("role_id")}>
              <select id="f-role" className={CHAMP} value={valeurs.role_id} onChange={maj("role_id")}>
                <option value="">Choisir…</option>
                {rolesAffiches.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom_role}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ id="f-dep" label="Département" erreur={err("departement_id")}>
              <select id="f-dep" className={CHAMP} value={valeurs.departement_id} onChange={maj("departement_id")}>
                <option value="">Aucun</option>
                {departements.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom_departement}
                  </option>
                ))}
              </select>
            </Champ>
          </div>

          <Champ id="f-poste" label="Poste" erreur={err("poste")}>
            <input id="f-poste" className={CHAMP} value={valeurs.poste} onChange={maj("poste")} maxLength={100} />
          </Champ>

          <div className="grid grid-cols-2 gap-3">
            <Champ id="f-tel" label="Téléphone" erreur={err("telephone")}>
              <input
                id="f-tel"
                type="tel"
                className={CHAMP}
                value={valeurs.telephone}
                onChange={maj("telephone")}
                maxLength={30}
              />
            </Champ>
            <Champ id="f-date" label="Date d’embauche" erreur={err("date_embauche")}>
              <input
                id="f-date"
                type="date"
                className={CHAMP}
                value={valeurs.date_embauche}
                onChange={maj("date_embauche")}
              />
            </Champ>
          </div>
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
            {edition ? "Enregistrer" : "Créer le compte"}
          </button>
        </footer>
      </form>
    </div>
  );
}

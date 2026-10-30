"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";
import type { DepartementOption } from "./contenu-formulaire";

export type Evenement = {
  id: number;
  titre_evenement: string;
  description_evenement: string | null;
  date_debut: string;
  date_fin: string;
  lieu: string | null;
  visibilite: "entreprise" | "departement";
  departement_id: number | null;
  auteur: { id: number; nom: string; prenom: string } | null;
};

const zero = (n: number) => String(n).padStart(2, "0");

export const lireDate = (s: string) => new Date(s.replace(" ", "T"));
export const cleJour = (d: Date) => `${d.getFullYear()}-${zero(d.getMonth() + 1)}-${zero(d.getDate())}`;
export const versChampDate = (d: Date) => `${cleJour(d)}T${zero(d.getHours())}:${zero(d.getMinutes())}`;
const versServeur = (champ: string) => `${champ.replace("T", " ")}:00`;

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
  evenement: Evenement | null;
  debutParDefaut: Date;
  departements: DepartementOption[];
  onFermer: () => void;
  onEnregistre: (message: string) => void;
};

export function EvenementFormulaire({ evenement, debutParDefaut, departements, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = evenement !== null;

  const [titre, setTitre] = useState(evenement?.titre_evenement ?? "");
  const [lieu, setLieu] = useState(evenement?.lieu ?? "");
  const [debut, setDebut] = useState(
    evenement ? versChampDate(lireDate(evenement.date_debut)) : versChampDate(debutParDefaut),
  );
  const [fin, setFin] = useState(
    evenement
      ? versChampDate(lireDate(evenement.date_fin))
      : versChampDate(new Date(debutParDefaut.getTime() + 60 * 60 * 1000)),
  );
  const [description, setDescription] = useState(evenement?.description_evenement ?? "");
  const [visibilite, setVisibilite] = useState<"entreprise" | "departement">(evenement?.visibilite ?? "entreprise");
  const [departementId, setDepartementId] = useState(evenement?.departement_id ? String(evenement.departement_id) : "");
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

  function changerDebut(valeur: string) {
    if (valeur && debut && fin) {
      const duree = new Date(fin).getTime() - new Date(debut).getTime();
      const nouveau = new Date(valeur).getTime();
      if (!Number.isNaN(duree) && !Number.isNaN(nouveau) && duree >= 0)
        setFin(versChampDate(new Date(nouveau + duree)));
    }
    setDebut(valeur);
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setErreurs({});
    setMessage(null);

    if (debut && fin && new Date(fin) < new Date(debut)) {
      setErreurs({ date_fin: ["La date de fin doit être postérieure ou égale à la date de début."] });
      setMessage("Certains champs sont à corriger.");
      return;
    }

    setEnvoi(true);
    const corps = {
      titre_evenement: titre.trim(),
      description_evenement: description.trim() || null,
      date_debut: debut ? versServeur(debut) : "",
      date_fin: fin ? versServeur(fin) : "",
      lieu: lieu.trim() || null,
      visibilite,
      departement_id: visibilite === "departement" && departementId ? Number(departementId) : null,
    };

    try {
      await api<Evenement>(edition ? `/evenements/${evenement.id}` : "/evenements", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify(corps),
      });
      onEnregistre(edition ? "Événement modifié." : "Événement créé.");
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
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-evt">
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
          <h2 id="titre-formulaire-evt" className="font-display text-base font-semibold">
            {edition ? "Modifier l’événement" : "Nouvel événement"}
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

          <Champ id="e-titre" label="Titre" requis erreur={err("titre_evenement")}>
            <input
              id="e-titre"
              ref={premierChamp}
              className={CHAMP}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              maxLength={150}
              autoComplete="off"
            />
          </Champ>

          <Champ id="e-lieu" label="Lieu" erreur={err("lieu")}>
            <input
              id="e-lieu"
              className={CHAMP}
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              maxLength={100}
              autoComplete="off"
            />
          </Champ>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ id="e-debut" label="Début" requis erreur={err("date_debut")}>
              <input
                id="e-debut"
                type="datetime-local"
                className={CHAMP}
                value={debut}
                onChange={(e) => changerDebut(e.target.value)}
              />
            </Champ>
            <Champ id="e-fin" label="Fin" requis erreur={err("date_fin")}>
              <input
                id="e-fin"
                type="datetime-local"
                className={CHAMP}
                value={fin}
                min={debut || undefined}
                onChange={(e) => setFin(e.target.value)}
              />
            </Champ>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ id="e-visi" label="Destinataires" requis erreur={err("visibilite")}>
              <select
                id="e-visi"
                className={CHAMP}
                value={visibilite}
                onChange={(e) => setVisibilite(e.target.value as "entreprise" | "departement")}
              >
                <option value="entreprise">Toute l’entreprise</option>
                <option value="departement">Un département</option>
              </select>
            </Champ>

            {visibilite === "departement" && (
              <Champ id="e-dep" label="Département" requis erreur={err("departement_id")}>
                <select
                  id="e-dep"
                  className={CHAMP}
                  value={departementId}
                  onChange={(e) => setDepartementId(e.target.value)}
                >
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

          <Champ id="e-desc" label="Description" erreur={err("description_evenement")}>
            <textarea
              id="e-desc"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            {edition ? "Enregistrer" : "Créer l’événement"}
          </button>
        </footer>
      </form>
    </div>
  );
}

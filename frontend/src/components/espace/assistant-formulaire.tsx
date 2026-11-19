"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import type { ChampFormulaire, FormulaireAssistant, ValeursFormulaire } from "@/lib/assistant";
import { OUTILS } from "./assistant-catalogue";

const CLASSE_CHAMP =
  "w-full rounded-xl border border-site-line bg-site-base px-3 py-2 text-sm outline-none placeholder:text-site-muted focus-visible:border-brand-violet/60 focus-visible:ring-2 focus-visible:ring-brand-violet/30";

/** Options du champ, filtrées selon l'autre champ dont il dépend (ex. contenus du type choisi). */
function optionsVisibles(champ: ChampFormulaire, valeurs: ValeursFormulaire) {
  const options = champ.options ?? [];
  if (!champ.si) return options;
  const filtre = valeurs[champ.si.champ];
  return filtre ? options.filter((o) => o.type === filtre) : options;
}

/** Formulaire affiché dans le chat : la personne vérifie et complète, le serveur contrôle ensuite. */
export function FormulaireAssistantCarte({
  formulaire,
  enCours,
  erreur,
  onValider,
  onAnnuler,
}: {
  formulaire: FormulaireAssistant;
  enCours: boolean;
  erreur?: string;
  onValider: (valeurs: ValeursFormulaire) => void;
  onAnnuler: () => void;
}) {
  const base = useId();
  const { Icone } = OUTILS[formulaire.outil] ?? { Icone: Check };
  const [valeurs, setValeurs] = useState<ValeursFormulaire>(() =>
    Array.isArray(formulaire.valeurs) ? {} : { ...formulaire.valeurs },
  );
  const [manque, setManque] = useState<string | null>(null);

  function changer(champ: ChampFormulaire, valeur: string | number | boolean) {
    setManque(null);
    setValeurs((actuelles) => {
      const suivantes: ValeursFormulaire = { ...actuelles, [champ.nom]: valeur };
      // un champ dépendant (ex. contenu) est vidé si son choix n'existe plus pour la nouvelle valeur
      for (const autre of formulaire.champs) {
        if (autre.si?.champ === champ.nom && suivantes[autre.nom] !== undefined) {
          const reste = optionsVisibles(autre, suivantes).some((o) => String(o.valeur) === String(suivantes[autre.nom]));
          if (!reste) delete suivantes[autre.nom];
        }
      }
      return suivantes;
    });
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const absent = formulaire.champs.find(
      (c) => c.requis && c.type !== "oui_non" && (valeurs[c.nom] === undefined || String(valeurs[c.nom]).trim() === ""),
    );
    if (absent) {
      setManque(`Renseignez : ${absent.libelle}.`);
      return;
    }
    const nettoyees: ValeursFormulaire = {};
    for (const [cle, v] of Object.entries(valeurs)) {
      if (v !== "" && v !== undefined) nettoyees[cle] = v;
    }
    onValider(nettoyees);
  }

  return (
    <form onSubmit={soumettre} className="space-y-3 rounded-xl border border-site-line bg-site-base p-3">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-violet">
        <Icone size={14} aria-hidden />
        {formulaire.titre}
      </p>
      {formulaire.aide && <p className="text-xs text-site-muted">{formulaire.aide}</p>}

      {formulaire.champs.map((champ) => {
        const id = `${base}-${champ.nom}`;
        const valeur = valeurs[champ.nom];

        if (champ.type === "oui_non") {
          return (
            <label key={champ.nom} htmlFor={id} className="flex items-center gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={valeur === true}
                onChange={(e) => changer(champ, e.target.checked)}
                className="size-4 accent-[var(--color-brand-violet,#8b5cf6)]"
              />
              {champ.libelle}
            </label>
          );
        }

        return (
          <div key={champ.nom} className="space-y-1">
            <label htmlFor={id} className="block text-xs font-medium text-site-muted">
              {champ.libelle}
              {champ.requis && <span aria-hidden> *</span>}
            </label>

            {champ.type === "choix" ? (
              <select
                id={id}
                value={valeur === undefined ? "" : String(valeur)}
                onChange={(e) => {
                  const choisie = (champ.options ?? []).find((o) => String(o.valeur) === e.target.value);
                  changer(champ, choisie ? choisie.valeur : "");
                }}
                className={CLASSE_CHAMP}
              >
                <option value="">{champ.vide ?? (champ.requis ? "Choisir…" : "—")}</option>
                {optionsVisibles(champ, valeurs).map((o) => (
                  <option key={String(o.valeur)} value={String(o.valeur)}>
                    {o.libelle}
                  </option>
                ))}
              </select>
            ) : champ.type === "zone" ? (
              <textarea
                id={id}
                rows={4}
                value={String(valeur ?? "")}
                onChange={(e) => changer(champ, e.target.value)}
                className={`${CLASSE_CHAMP} resize-y`}
              />
            ) : (
              <input
                id={id}
                type={champ.type === "date" ? "date" : champ.type === "date_heure" ? "datetime-local" : "text"}
                value={String(valeur ?? "")}
                onChange={(e) => changer(champ, e.target.value)}
                className={CLASSE_CHAMP}
              />
            )}
          </div>
        );
      })}

      {(manque || erreur) && (
        <p role="alert" className="text-xs text-site-danger">
          {manque ?? erreur}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onAnnuler}
          disabled={enCours}
          className="h-9 rounded-full border border-site-line px-4 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-violet px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
        >
          {enCours ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
          Valider
        </button>
      </div>
    </form>
  );
}

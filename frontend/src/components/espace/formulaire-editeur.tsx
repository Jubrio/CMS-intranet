"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, Lock, Plus, Trash2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";
import type { DepartementOption } from "./contenu-formulaire";

export type TypeChamp = "texte" | "texte_long" | "nombre" | "date" | "choix_unique" | "choix_multiple";

export type ChampDef = {
  nom: string;
  libelle: string;
  type: TypeChamp;
  obligatoire: boolean;
  options?: string[];
};

export type StatutFormulaire = "brouillon" | "publie" | "cloture";

export type FormulaireInterne = {
  id: number;
  titre_formulaire: string;
  visibilite: "entreprise" | "departement";
  departement_id: number | null;
  reponse_unique: boolean;
  date_limite: string | null; // « 2026-11-12 »
  statut_formulaire: StatutFormulaire;
  auteur: { id: number; nom: string; prenom: string } | null;
  created_at: string;
  nb_reponses?: number;
  champs?: ChampDef[];
};

export const TYPES: { code: TypeChamp; libelle: string }[] = [
  { code: "texte", libelle: "Texte court" },
  { code: "texte_long", libelle: "Texte long" },
  { code: "nombre", libelle: "Nombre" },
  { code: "date", libelle: "Date" },
  { code: "choix_unique", libelle: "Choix unique" },
  { code: "choix_multiple", libelle: "Choix multiple" },
];

const MAX_CHAMPS = 30;
const estChoix = (t: TypeChamp) => t === "choix_unique" || t === "choix_multiple";

// Champ en cours d'édition : `cle` sert d'identifiant stable pour React, `nom` n'existe que pour les champs déjà enregistrés
type ChampEdite = { cle: number; nom: string | null; libelle: string; type: TypeChamp; obligatoire: boolean; options: string };

let compteur = 0;
const nouvelleCle = () => ++compteur;

const champVide = (): ChampEdite => ({ cle: nouvelleCle(), nom: null, libelle: "", type: "texte", obligatoire: false, options: "" });

// Identifiant technique d'un champ (a-z, 0-9, _) déduit de son libellé
function identifiant(libelle: string): string {
  const base = libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(base) ? base : `champ_${base}`.replace(/_$/, "");
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
  formulaire: FormulaireInterne | null; // null = création
  departements: DepartementOption[];
  onFermer: () => void;
  onEnregistre: (message: string, echecPublication?: string) => void;
};

export function FormulaireEditeur({ formulaire, departements, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = formulaire !== null;
  const dejaPublie = formulaire?.statut_formulaire === "publie";
  // Les champs sont verrouillés dès la première réponse
  const verrouille = edition && (formulaire.nb_reponses ?? 0) > 0;

  const [titre, setTitre] = useState(formulaire?.titre_formulaire ?? "");
  const [visibilite, setVisibilite] = useState<"entreprise" | "departement">(formulaire?.visibilite ?? "entreprise");
  const [departementId, setDepartementId] = useState(formulaire?.departement_id ? String(formulaire.departement_id) : "");
  const [dateLimite, setDateLimite] = useState(formulaire?.date_limite ?? "");
  const [reponseUnique, setReponseUnique] = useState(formulaire?.reponse_unique ?? false);
  const [champs, setChamps] = useState<ChampEdite[]>([champVide()]);
  const [chargement, setChargement] = useState(edition);
  const [echecChargement, setEchecChargement] = useState(false);
  const [envoi, setEnvoi] = useState<"enregistrer" | "publier" | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [erreursLocales, setErreursLocales] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  // La définition des champs n'est pas dans la liste
  const formulaireId = formulaire?.id ?? null;
  useEffect(() => {
    if (formulaireId === null) return;
    let annule = false;
    api<FormulaireInterne>(`/formulaires/${formulaireId}`, { token })
      .then((d) => {
        if (annule) return;
        setChamps(
          (d.champs ?? []).map((c) => ({
            cle: nouvelleCle(),
            nom: c.nom,
            libelle: c.libelle,
            type: c.type,
            obligatoire: c.obligatoire,
            options: (c.options ?? []).join("\n"),
          })),
        );
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
  }, [formulaireId, token, expirer]);

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
  // Erreur du serveur propre au champ n° i (« champs.2.libelle », « champs.2.options.1 », …)
  const erreurChamp = (i: number) => erreursLocales[i] ?? Object.entries(erreurs).find(([k]) => k.startsWith(`champs.${i}.`))?.[1][0];

  function modifier(cle: number, modif: Partial<ChampEdite>) {
    setChamps((l) => l.map((c) => (c.cle === cle ? { ...c, ...modif } : c)));
  }

  function deplacer(index: number, sens: -1 | 1) {
    setChamps((l) => {
      const cible = index + sens;
      if (cible < 0 || cible >= l.length) return l;
      const copie = [...l];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
  }

  async function soumettre(publier: boolean) {
    if (envoi || chargement || echecChargement) return;
    setErreurs({});
    setErreursLocales({});
    setMessage(null);

    // Contrôles de saisie avant l'envoi
    const locales: Record<number, string> = {};
    champs.forEach((c, i) => {
      if (verrouille) return;
      if (!c.libelle.trim()) locales[i] = "Le libellé du champ est obligatoire.";
      else if (estChoix(c.type) && new Set(c.options.split("\n").map((o) => o.trim()).filter(Boolean)).size < 2)
        locales[i] = "Ajoutez au moins 2 options, une par ligne.";
    });
    if (Object.keys(locales).length > 0) {
      setErreursLocales(locales);
      setMessage("Certains champs sont à corriger.");
      return;
    }

    setEnvoi(publier ? "publier" : "enregistrer");

    // Identifiants : on garde ceux des champs déjà enregistrés, on en crée pour les nouveaux (uniques)
    const pris = new Set(champs.map((c) => c.nom).filter((n): n is string => n !== null));
    const definitions: ChampDef[] = champs.map((c) => {
      let nom = c.nom;
      if (nom === null) {
        const base = identifiant(c.libelle);
        nom = base;
        for (let n = 2; pris.has(nom); n++) nom = `${base.slice(0, 46)}_${n}`;
        pris.add(nom);
      }
      const def: ChampDef = { nom, libelle: c.libelle.trim(), type: c.type, obligatoire: c.obligatoire };
      if (estChoix(c.type)) def.options = [...new Set(c.options.split("\n").map((o) => o.trim()).filter(Boolean))];
      return def;
    });

    const corps: Record<string, unknown> = {
      titre_formulaire: titre.trim(),
      visibilite,
      departement_id: visibilite === "departement" && departementId ? Number(departementId) : null,
      reponse_unique: reponseUnique,
    };
    if (!verrouille) corps.champs = definitions;
    // La date limite n'est renvoyée que si elle change : le serveur refuse une date passée
    if (!edition || dateLimite !== (formulaire.date_limite ?? "")) corps.date_limite = dateLimite || null;
    if (!edition) corps.statut_formulaire = publier ? "publie" : "brouillon";

    let id = formulaire?.id ?? null;
    try {
      const res = await api<FormulaireInterne>(edition ? `/formulaires/${formulaire.id}` : "/formulaires", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify(corps),
      });
      id = res.id;
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

    // À la création le statut est déjà fixé ; sur un brouillon existant, « publier » est une seconde étape
    if (!publier || !edition || dejaPublie || id === null) {
      onEnregistre(edition ? "Formulaire modifié." : publier ? "Formulaire publié." : "Formulaire enregistré en brouillon.");
      return;
    }

    try {
      await api<FormulaireInterne>(`/formulaires/${id}/publier`, { method: "POST", token });
      onEnregistre("Formulaire publié.");
    } catch (e3) {
      if (e3 instanceof ApiError && e3.status === 401) {
        expirer();
        return;
      }
      onEnregistre("Formulaire modifié.", messageErreur(e3));
    }
  }

  const occupe = envoi !== null || chargement;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-editeur-formulaire">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void soumettre(false);
        }}
        noValidate
        className="relative ml-auto flex h-full w-full max-w-2xl flex-col border-l border-site-line bg-site-surface shadow-2xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-editeur-formulaire" className="font-display text-base font-semibold">
            {edition ? "Modifier le formulaire" : "Nouveau formulaire"}
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {message && (
            <p role="alert" className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger">
              {message}
            </p>
          )}

          {chargement ? (
            <div aria-hidden className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-site-line" />
              <div className="h-10 animate-pulse rounded-lg bg-site-line" />
              <div className="h-40 animate-pulse rounded-xl bg-site-line/70" />
            </div>
          ) : echecChargement ? null : (
            <>
              <Champ id="fo-titre" label="Titre du formulaire" requis erreur={err("titre_formulaire")}>
                <input id="fo-titre" ref={premierChamp} className={CHAMP} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={150} autoComplete="off" />
              </Champ>

              <div className="grid gap-4 sm:grid-cols-2">
                <Champ id="fo-visi" label="Destinataires" requis erreur={err("visibilite")}>
                  <select id="fo-visi" className={CHAMP} value={visibilite} onChange={(e) => setVisibilite(e.target.value as "entreprise" | "departement")}>
                    <option value="entreprise">Toute l’entreprise</option>
                    <option value="departement">Un département</option>
                  </select>
                </Champ>

                {visibilite === "departement" && (
                  <Champ id="fo-dep" label="Département" requis erreur={err("departement_id")}>
                    <select id="fo-dep" className={CHAMP} value={departementId} onChange={(e) => setDepartementId(e.target.value)}>
                      <option value="">{departements.length === 0 ? "Aucun département disponible" : "Choisir…"}</option>
                      {departements.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nom_departement}
                        </option>
                      ))}
                    </select>
                  </Champ>
                )}

                <Champ id="fo-limite" label="Date limite" erreur={err("date_limite")} aide="Facultatif. Le jour de la date limite, le formulaire reste ouvert.">
                  <input id="fo-limite" type="date" className={CHAMP} value={dateLimite} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateLimite(e.target.value)} />
                </Champ>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-site-line bg-site-base/40 px-4 py-3">
                <input type="checkbox" checked={reponseUnique} onChange={(e) => setReponseUnique(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-violet" />
                <span>
                  <span className="block text-sm font-medium">Une seule réponse par personne</span>
                  <span className="block text-xs text-site-muted">Chaque destinataire ne peut remplir ce formulaire qu’une fois.</span>
                </span>
              </label>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-xs font-medium text-site-muted">
                    Champs<span className="text-site-danger"> *</span>
                  </h3>
                  <span className="text-xs tabular-nums text-site-muted">
                    {champs.length} / {MAX_CHAMPS}
                  </span>
                </div>

                {verrouille && (
                  <p className="mb-3 flex items-start gap-2 rounded-lg border border-site-line bg-site-base/60 px-3 py-2 text-xs text-site-muted">
                    <Lock size={14} aria-hidden className="mt-0.5 shrink-0" />
                    Les champs ne sont plus modifiables : le formulaire a déjà reçu {formulaire.nb_reponses} réponse{(formulaire.nb_reponses ?? 0) > 1 ? "s" : ""}.
                  </p>
                )}
                {err("champs") && <p className="mb-2 text-xs text-site-danger">{err("champs")}</p>}

                <ol className="space-y-3">
                  {champs.map((c, i) => {
                    const e = erreurChamp(i);
                    return (
                      <li key={c.cle} className={cn("rounded-xl border bg-site-base/40 p-4", e ? "border-site-danger/50" : "border-site-line")}>
                        <div className="mb-3 flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-violet/15 text-[11px] font-bold tabular-nums text-brand-violet">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-site-muted">{c.nom ? `Identifiant : ${c.nom}` : "Nouveau champ"}</span>
                          {!verrouille && (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => deplacer(i, -1)}
                                disabled={i === 0}
                                aria-label={`Monter le champ ${i + 1}`}
                                className="flex size-7 items-center justify-center rounded-md text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                              >
                                <ArrowUp size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => deplacer(i, 1)}
                                disabled={i === champs.length - 1}
                                aria-label={`Descendre le champ ${i + 1}`}
                                className="flex size-7 items-center justify-center rounded-md text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                              >
                                <ArrowDown size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => setChamps((l) => l.filter((x) => x.cle !== c.cle))}
                                disabled={champs.length === 1}
                                aria-label={`Supprimer le champ ${i + 1}`}
                                className="flex size-7 items-center justify-center rounded-md text-site-muted transition-colors hover:bg-site-danger/10 hover:text-site-danger disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Trash2 size={14} aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                          <div>
                            <label htmlFor={`fo-lib-${c.cle}`} className="sr-only">
                              Libellé du champ {i + 1}
                            </label>
                            <input
                              id={`fo-lib-${c.cle}`}
                              className={CHAMP}
                              value={c.libelle}
                              onChange={(ev) => modifier(c.cle, { libelle: ev.target.value })}
                              placeholder="Libellé, par exemple « Votre nom complet »"
                              maxLength={150}
                              autoComplete="off"
                              disabled={verrouille}
                            />
                          </div>
                          <div>
                            <label htmlFor={`fo-type-${c.cle}`} className="sr-only">
                              Type du champ {i + 1}
                            </label>
                            <select id={`fo-type-${c.cle}`} className={CHAMP} value={c.type} onChange={(ev) => modifier(c.cle, { type: ev.target.value as TypeChamp })} disabled={verrouille}>
                              {TYPES.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.libelle}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {estChoix(c.type) && (
                          <div className="mt-3">
                            <label htmlFor={`fo-opt-${c.cle}`} className="mb-1.5 block text-xs font-medium text-site-muted">
                              Options (une par ligne, 2 minimum)
                            </label>
                            <textarea
                              id={`fo-opt-${c.cle}`}
                              rows={4}
                              value={c.options}
                              onChange={(ev) => modifier(c.cle, { options: ev.target.value })}
                              disabled={verrouille}
                              className={cn(CHAMP, "h-auto resize-y py-2")}
                            />
                          </div>
                        )}

                        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={c.obligatoire}
                            onChange={(ev) => modifier(c.cle, { obligatoire: ev.target.checked })}
                            disabled={verrouille}
                            className="size-4 accent-brand-violet"
                          />
                          Réponse obligatoire
                        </label>

                        {e && <p className="mt-2 text-xs text-site-danger">{e}</p>}
                      </li>
                    );
                  })}
                </ol>

                {!verrouille && (
                  <button
                    type="button"
                    onClick={() => setChamps((l) => [...l, champVide()])}
                    disabled={champs.length >= MAX_CHAMPS}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-dashed border-site-line px-4 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Plus size={16} aria-hidden />
                    {champs.length >= MAX_CHAMPS ? "Limite atteinte" : "Ajouter un champ"}
                  </button>
                )}
              </div>
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
              dejaPublie ? "v-gradient-btn" : "border border-site-line text-site-ink transition-colors hover:border-brand-violet/60",
              (occupe || echecChargement) && "opacity-70",
            )}
          >
            {envoi === "enregistrer" && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {edition ? "Enregistrer" : "Enregistrer en brouillon"}
          </button>
          {!dejaPublie && (
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

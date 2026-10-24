"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";
import { ImagesContenu } from "./images-contenu";
import type { ImageContenu } from "./lecteur-contenu";
import { textes, type ConfigContenu } from "./contenus-config";

export type Statut = "brouillon" | "publie" | "archive";

export type Contenu = {
  id: number;
  titre: string;
  categorie: string | null;
  statut_contenu: Statut;
  visibilite: "entreprise" | "departement";
  departement_id: number | null;
  date_publication: string | null;
  date_expiration?: string | null;
  numero_note?: string | null;
  auteur: { id: number; nom: string; prenom: string } | null;
  extrait?: string;
  corps?: string;
  images?: ImageContenu[];
};

export type DepartementOption = { id: number; nom_departement: string };

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
  config: ConfigContenu;
  contenu: Contenu | null; // null = création
  departements: DepartementOption[];
  manager: boolean; // RG21 : un Manager ne publie que pour son département
  onFermer: () => void;
  // `echecPublication` : enregistrée mais non publiée
  onEnregistre: (message: string, echecPublication?: string) => void;
};

export function ContenuFormulaire({ config, contenu, departements, manager, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const t = textes(config);
  const edition = contenu !== null;
  const dejaPubliee = contenu?.statut_contenu === "publie";

  const [titre, setTitre] = useState(contenu?.titre ?? "");
  const [categorie, setCategorie] = useState(contenu?.categorie ?? "");
  const [corps, setCorps] = useState("");
  const [images, setImages] = useState<ImageContenu[]>([]);
  const [numero, setNumero] = useState(contenu?.numero_note ?? "");
  const [expiration, setExpiration] = useState(contenu?.date_expiration ?? "");
  const [visibilite, setVisibilite] = useState<"entreprise" | "departement">(manager ? "departement" : (contenu?.visibilite ?? "entreprise"));
  const [departementId, setDepartementId] = useState(contenu?.departement_id ? String(contenu.departement_id) : "");
  const [chargement, setChargement] = useState(edition);
  const [echecChargement, setEchecChargement] = useState(false);
  const [envoi, setEnvoi] = useState<"enregistrer" | "publier" | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  // Le corps complet n'est pas dans la liste
  const contenuId = contenu?.id ?? null;
  useEffect(() => {
    if (contenuId === null) return;
    let annule = false;
    api<Contenu>(`/contenus/${config.type}/${contenuId}`, { token })
      .then((d) => {
        if (annule) return;
        setCorps(d.corps ?? "");
        setImages(d.images ?? []);
        setExpiration(d.date_expiration ?? "");
        setNumero(d.numero_note ?? "");
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
  }, [contenuId, token, expirer, config.type]);

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

  async function soumettre(e: { preventDefault: () => void }, publier: boolean) {
    e.preventDefault();
    if (envoi || chargement || echecChargement) return;
    setEnvoi(publier ? "publier" : "enregistrer");
    setErreurs({});
    setMessage(null);

    const visible = manager ? "departement" : visibilite;
    const corpsEnvoye = {
      titre: titre.trim(),
      corps,
      categorie: categorie.trim() || null,
      visibilite: visible,
      departement_id: visible === "departement" && departementId ? Number(departementId) : null,
      ...(config.expiration ? { date_expiration: expiration || null } : {}),
      ...(config.numero ? { numero_note: numero.trim() } : {}),
    };

    let id = contenu?.id ?? null;
    try {
      const res = await api<Contenu>(edition ? `/contenus/${config.type}/${contenu.id}` : `/contenus/${config.type}`, {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify(corpsEnvoye),
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

    if (!publier || id === null) {
      onEnregistre(edition ? t.modifiee : t.brouillon);
      return;
    }

    try {
      await api<Contenu>(`/contenus/${config.type}/${id}/publier`, { method: "POST", token });
      onEnregistre(t.publiee);
    } catch (e3) {
      if (e3 instanceof ApiError && e3.status === 401) {
        expirer();
        return;
      }
      onEnregistre(edition ? t.modifiee : t.brouillon, messageErreur(e3));
    }
  }

  const occupe = envoi !== null || chargement;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-contenu">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <form onSubmit={(e) => soumettre(e, false)} noValidate className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-formulaire-contenu" className="font-display text-base font-semibold">
            {edition ? t.modifierTitre : t.nouveau}
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
              {config.numero && (
                <Champ id="a-num" label="Numéro de la note" requis erreur={err("numero_note")} aide="Unique dans l’entreprise, par exemple « NS-2026-014 ».">
                  <input id="a-num" ref={premierChamp} className={CHAMP} value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={20} autoComplete="off" />
                </Champ>
              )}

              <Champ id="a-titre" label="Titre" requis erreur={err("titre")}>
                <input id="a-titre" ref={config.numero ? undefined : premierChamp} className={CHAMP} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={150} autoComplete="off" />
              </Champ>

              <Champ id="a-cat" label="Catégorie" erreur={err("categorie")} aide="Facultatif, par exemple « Vie de l’entreprise ».">
                <input id="a-cat" className={CHAMP} value={categorie} onChange={(e) => setCategorie(e.target.value)} maxLength={50} autoComplete="off" />
              </Champ>

              <div className="grid gap-4 sm:grid-cols-2">
                <Champ id="a-visi" label="Destinataires" requis erreur={err("visibilite")}>
                  <select
                    id="a-visi"
                    className={CHAMP}
                    value={manager ? "departement" : visibilite}
                    disabled={manager}
                    onChange={(e) => setVisibilite(e.target.value as "entreprise" | "departement")}
                  >
                    <option value="entreprise">Toute l’entreprise</option>
                    <option value="departement">Un département</option>
                  </select>
                </Champ>

                {(manager || visibilite === "departement") && (
                  <Champ
                    id="a-dep"
                    label="Département"
                    requis
                    erreur={err("departement_id")}
                    aide={manager ? "En tant que Manager, vous publiez pour votre département." : undefined}
                  >
                    <select id="a-dep" className={CHAMP} value={departementId} disabled={manager} onChange={(e) => setDepartementId(e.target.value)}>
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

              {config.expiration && (
                <Champ id="a-exp" label="Date d’expiration" erreur={err("date_expiration")} aide="Facultatif. Après cette date, l’annonce n’est plus affichée.">
                  <input id="a-exp" type="date" className={CHAMP} value={expiration} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpiration(e.target.value)} />
                </Champ>
              )}

              <Champ id="a-corps" label="Contenu" requis erreur={err("corps")}>
                <textarea id="a-corps" rows={12} value={corps} onChange={(e) => setCorps(e.target.value)} className={cn(CHAMP, "h-auto resize-y py-2 leading-relaxed")} />
              </Champ>

              {config.type !== "note_service" &&
                (edition && contenu ? (
                  <ImagesContenu type={config.type} contenuId={contenu.id} images={images} onChange={setImages} />
                ) : (
                  <p className="text-[11px] text-site-muted">Les images peuvent être ajoutées une fois la publication enregistrée en brouillon : rouvrez-la pour les joindre.</p>
                ))}
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
            {dejaPubliee ? "Enregistrer" : edition ? "Enregistrer" : "Enregistrer en brouillon"}
          </button>
          {!dejaPubliee && (
            <button
              type="button"
              disabled={occupe || echecChargement}
              onClick={(e) => soumettre(e, true)}
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

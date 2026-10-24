"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Camera, Check, ImageIcon, Layers, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import type { Personnalisation } from "@/lib/espace";
import { COULEURS_PAR_DEFAUT, FORMAT_COULEUR, PALETTES, contrasteAvecBlanc, variablesTheme } from "@/lib/apparence";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";

const TYPES_LOGO = ["image/jpeg", "image/png", "image/webp"];
const POIDS_MAX_LOGO = 2 * 1024 * 1024;

type Notice = { type: "ok" | "erreur"; texte: string } | null;

function Carte({ titre, aide, children }: { titre: string; aide?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm">
      <h2 className="font-display text-sm font-semibold">{titre}</h2>
      {aide && <p className="mt-1 text-xs text-site-muted">{aide}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChampCouleur({
  id,
  label,
  valeur,
  erreur,
  onChange,
}: {
  id: string;
  label: string;
  valeur: string;
  erreur?: string;
  onChange: (v: string) => void;
}) {
  const valide = FORMAT_COULEUR.test(valeur);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-site-muted">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} : sélecteur de couleur`}
          value={valide ? valeur.toLowerCase() : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-site-line bg-transparent p-1"
        />
        <input
          id={id}
          value={valeur}
          onChange={(e) => onChange(e.target.value.trim().toUpperCase())}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!valide || undefined}
          className={cn(CHAMP, "max-w-36 font-mono uppercase", !valide && "border-site-danger")}
        />
      </div>
      {!valide && <p className="mt-1 text-xs text-site-danger">Format attendu : #RRGGBB (ex. #1D4ED8).</p>}
      {erreur && valide && <p className="mt-1 text-xs text-site-danger">{erreur}</p>}
    </div>
  );
}

function Apercu({
  perso,
  principale,
  secondaire,
}: {
  perso: Personnalisation;
  principale: string;
  secondaire: string;
}) {
  return (
    <div
      style={variablesTheme(principale, secondaire)}
      className="overflow-hidden rounded-2xl border border-site-line bg-site-base shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-site-line bg-site-surface px-4 py-3">
        {perso.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={perso.logo_url} alt="" className="size-9 shrink-0 rounded-lg bg-site-surface2 object-contain p-1" />
        ) : (
          <span className="v-gradient-btn flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Layers size={18} strokeWidth={2.25} aria-hidden />
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-sm font-semibold">{perso.nom_entreprise}</p>
          <p className="truncate text-[11px] text-site-muted">Espace d’administration</p>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <ul className="space-y-1" aria-hidden>
          <li className="flex items-center gap-3 rounded-lg bg-brand-violet/15 px-3 py-2 text-sm font-medium text-brand-violet">
            <span className="size-4 rounded bg-brand-violet/40" />
            Page active
          </li>
          <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-site-muted">
            <span className="size-4 rounded bg-site-line" />
            Autre page
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <span className="v-gradient-btn inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold">
            Bouton principal
          </span>
          <span className="inline-flex rounded-full bg-brand-blue/15 px-2.5 py-1 text-[11px] font-semibold text-brand-blue">
            Étiquette
          </span>
        </div>

        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-site-line">
          <div className="v-gradient-btn h-full w-2/3 rounded-full" />
        </div>
        <p className="v-gradient-text font-display text-lg font-bold">Titre en dégradé</p>
      </div>
    </div>
  );
}

function FormulaireApparence({ initial }: { initial: Personnalisation }) {
  const { token, expirer, majPerso } = useEspace();

  const [base, setBase] = useState(initial);
  const [principale, setPrincipale] = useState(initial.couleur_principale ?? COULEURS_PAR_DEFAUT.principale);
  const [secondaire, setSecondaire] = useState(initial.couleur_secondaire ?? COULEURS_PAR_DEFAUT.secondaire);
  const [envoi, setEnvoi] = useState(false);
  const [televersement, setTeleversement] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [erreurLogo, setErreurLogo] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const champLogo = useRef<HTMLInputElement>(null);

  const valides = FORMAT_COULEUR.test(principale) && FORMAT_COULEUR.test(secondaire);
  const modifie =
    principale.toUpperCase() !== (base.couleur_principale ?? "").toUpperCase() ||
    secondaire.toUpperCase() !== (base.couleur_secondaire ?? "").toUpperCase();
  const clairs = valides ? [principale, secondaire].filter((c) => contrasteAvecBlanc(c) < 3) : [];

  const gererErreur = useCallback(
    (err: unknown): string | null => {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return null;
      }
      return messageErreur(err);
    },
    [expirer],
  );

  async function enregistrer() {
    if (!valides || envoi) return;
    setEnvoi(true);
    setErreurs({});
    setNotice(null);
    try {
      const res = await api<Personnalisation>("/personnalisation", {
        method: "PUT",
        token,
        body: JSON.stringify({ couleur_principale: principale, couleur_secondaire: secondaire }),
      });
      setBase(res);
      majPerso(res);
      setNotice({ type: "ok", texte: "Les couleurs sont enregistrées et appliquées à votre espace." });
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErreurs(err.errors);
      const texte = gererErreur(err);
      if (texte)
        setNotice({
          type: "erreur",
          texte: err instanceof ApiError && err.errors ? "Certains champs sont à corriger." : texte,
        });
    } finally {
      setEnvoi(false);
    }
  }

  async function choisirLogo(fichier: File | undefined) {
    if (!fichier) return;
    setErreurLogo(null);
    setNotice(null);
    if (!TYPES_LOGO.includes(fichier.type)) {
      setErreurLogo("Format non accepté. Utilisez une image JPG, PNG ou WebP.");
      return;
    }
    if (fichier.size > POIDS_MAX_LOGO) {
      setErreurLogo("Le logo dépasse 2 Mo.");
      return;
    }
    setTeleversement(true);
    try {
      const donnees = new FormData();
      donnees.append("logo", fichier);
      const res = await api<Personnalisation>("/personnalisation/logo", { method: "POST", token, body: donnees });
      setBase((b) => ({ ...b, logo_url: res.logo_url }));
      majPerso(res);
      setNotice({ type: "ok", texte: "Le logo est mis à jour." });
    } catch (err) {
      const texte = gererErreur(err);
      if (texte) setErreurLogo(err instanceof ApiError && err.errors?.logo?.[0] ? err.errors.logo[0] : texte);
    } finally {
      setTeleversement(false);
      if (champLogo.current) champLogo.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Carte titre="Logo" aide="Affiché en haut du menu latéral. JPG, PNG ou WebP, 2 Mo au maximum.">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-site-line bg-site-surface2">
                {base.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={base.logo_url} alt="Logo actuel" className="size-full object-contain p-2" />
                ) : (
                  <ImageIcon size={28} aria-hidden className="text-site-muted" />
                )}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => champLogo.current?.click()}
                  disabled={televersement}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:opacity-60"
                >
                  {televersement ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Camera size={16} aria-hidden />
                  )}
                  {base.logo_url ? "Changer le logo" : "Ajouter un logo"}
                </button>
                <input
                  ref={champLogo}
                  type="file"
                  accept={TYPES_LOGO.join(",")}
                  className="sr-only"
                  aria-label="Choisir un logo"
                  onChange={(e) => choisirLogo(e.target.files?.[0])}
                />
                {erreurLogo ? (
                  <p className="mt-1.5 text-xs text-site-danger">{erreurLogo}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-site-muted">Enregistré dès que vous choisissez le fichier.</p>
                )}
              </div>
            </div>
          </Carte>

          <Carte
            titre="Couleurs"
            aide="La couleur principale teinte les boutons et les éléments actifs, la secondaire accompagne le dégradé."
          >
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium text-site-muted">Palettes proposées</p>
                <ul className="flex flex-wrap gap-2">
                  {PALETTES.map((p) => {
                    const choisie =
                      principale.toUpperCase() === p.principale && secondaire.toUpperCase() === p.secondaire;
                    return (
                      <li key={p.nom}>
                        <button
                          type="button"
                          onClick={() => {
                            setPrincipale(p.principale);
                            setSecondaire(p.secondaire);
                          }}
                          aria-pressed={choisie}
                          className={cn(
                            "flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-semibold transition-colors",
                            choisie
                              ? "border-brand-violet/60 bg-brand-violet/10"
                              : "border-site-line hover:border-brand-violet/40",
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-6 rounded-full"
                            style={{ background: `linear-gradient(135deg, ${p.principale}, ${p.secondaire})` }}
                          />
                          {p.nom}
                          {choisie && <Check size={14} aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <ChampCouleur
                  id="c-principale"
                  label="Couleur principale"
                  valeur={principale}
                  erreur={erreurs.couleur_principale?.[0]}
                  onChange={setPrincipale}
                />
                <ChampCouleur
                  id="c-secondaire"
                  label="Couleur secondaire"
                  valeur={secondaire}
                  erreur={erreurs.couleur_secondaire?.[0]}
                  onChange={setSecondaire}
                />
              </div>

              {clairs.length > 0 && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-site-line bg-site-base/40 px-3 py-2 text-xs text-site-muted"
                >
                  <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    {clairs.length === 2 ? "Ces couleurs sont" : "Une de ces couleurs est"} claire
                    {clairs.length === 2 ? "s" : ""} : le texte blanc des boutons sera difficile à lire.
                  </span>
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-site-line pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPrincipale(COULEURS_PAR_DEFAUT.principale);
                    setSecondaire(COULEURS_PAR_DEFAUT.secondaire);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
                >
                  <RotateCcw size={14} aria-hidden />
                  Valeurs par défaut
                </button>
                <button
                  type="button"
                  onClick={enregistrer}
                  disabled={!valides || !modifie || envoi}
                  className={cn(
                    "v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {envoi && <Loader2 size={16} className="animate-spin" aria-hidden />}
                  Enregistrer les couleurs
                </button>
              </div>
            </div>
          </Carte>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-medium text-site-muted">Aperçu en direct</p>
          <Apercu perso={base} principale={principale} secondaire={secondaire} />
          <p className="mt-2 text-[11px] text-site-muted">
            L’aperçu change en direct ; rien n’est appliqué à l’espace avant l’enregistrement.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Apparence() {
  const { profil } = useEspace();
  const autorise = profil.permissions.includes("personnalisation.apparence");

  const charger = useCallback((jeton: string) => api<Personnalisation>("/personnalisation", { token: jeton }), []);
  const { donnees, erreur, reessayer } = useDonnees(autorise, charger);

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Vous n’avez pas accès à la personnalisation de l’apparence.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Apparence</h1>
        <p className="mt-1 text-sm text-site-muted">
          Personnalisez le logo et les couleurs de l’intranet de votre entreprise.
        </p>
      </div>

      {erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted shadow-sm">
          <span>Impossible de charger la personnalisation.</span>
          <button
            type="button"
            onClick={reessayer}
            className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            Réessayer
          </button>
        </div>
      ) : donnees === null ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" aria-hidden>
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl bg-site-line" />
            <div className="h-72 animate-pulse rounded-2xl bg-site-line" />
          </div>
          <div className="h-80 animate-pulse rounded-2xl bg-site-line" />
        </div>
      ) : (
        <FormulaireApparence initial={donnees} />
      )}
    </div>
  );
}

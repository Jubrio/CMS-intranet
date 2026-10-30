"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Loader2, Send, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import type { ChampDef, FormulaireInterne } from "./formulaire-editeur";

type Pagination<T> = { data: T[]; current_page: number; last_page: number; total: number };
type Element = FormulaireInterne & { deja_repondu?: boolean };
type Valeur = string | string[];

const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const lireJour = (s: string) => {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(a, m - 1, j);
};

const estDepasse = (limite: string | null) => {
  if (!limite) return false;
  const fin = lireJour(limite);
  fin.setDate(fin.getDate() + 1);
  return fin.getTime() <= Date.now();
};

const estChoixMultiple = (c: ChampDef) => c.type === "choix_multiple";
const estVide = (v: Valeur | undefined) => v === undefined || (Array.isArray(v) ? v.length === 0 : v.trim() === "");

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Remplissage({
  formulaire,
  onFermer,
  onEnvoye,
}: {
  formulaire: FormulaireInterne;
  onFermer: () => void;
  onEnvoye: () => void;
}) {
  const { token, expirer } = useEspace();
  const champs = formulaire.champs ?? [];

  const [valeurs, setValeurs] = useState<Record<string, Valeur>>(() =>
    Object.fromEntries(champs.map((c) => [c.nom, estChoixMultiple(c) ? [] : ""])),
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && !envoi && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer, envoi]);

  const modifier = (nom: string, v: Valeur) => {
    setValeurs((s) => ({ ...s, [nom]: v }));
    setErreurs((s) => {
      if (!s[nom]) return s;
      const reste = { ...s };
      delete reste[nom];
      return reste;
    });
  };

  const basculer = (nom: string, option: string) => {
    const actuel = (valeurs[nom] as string[]) ?? [];
    modifier(nom, actuel.includes(option) ? actuel.filter((o) => o !== option) : [...actuel, option]);
  };

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreurGlobale(null);

    const locales: Record<string, string> = {};
    for (const c of champs) {
      const v = valeurs[c.nom];
      if (estVide(v)) {
        if (c.obligatoire) locales[c.nom] = "Ce champ est obligatoire.";
      } else if (c.type === "nombre" && Number.isNaN(Number(v))) {
        locales[c.nom] = "Saisissez un nombre.";
      }
    }
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      return;
    }

    const payload: Record<string, string | number | string[]> = {};
    for (const c of champs) {
      const v = valeurs[c.nom];
      if (estVide(v)) continue;
      payload[c.nom] = c.type === "nombre" ? Number(v) : Array.isArray(v) ? v : v.trim();
    }

    setEnvoi(true);
    try {
      await api<{ message: string }>(`/formulaires/${formulaire.id}/reponses`, {
        method: "POST",
        token,
        body: JSON.stringify({ valeurs: payload }),
      });
      onEnvoye();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      if (err instanceof ApiError && err.errors) {
        const serveur: Record<string, string> = {};
        for (const [cle, messages] of Object.entries(err.errors)) {
          serveur[cle.replace(/^valeurs\./, "")] = messages[0];
        }
        setErreurs(serveur);
      }
      setErreurGlobale(messageErreur(err));
      setEnvoi(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-remplissage"
    >
      <button
        type="button"
        aria-label="Fermer"
        disabled={envoi}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <form
        onSubmit={envoyer}
        noValidate
        className="relative w-full max-w-xl rounded-2xl border border-site-line bg-site-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-site-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="titre-remplissage" className="font-display text-lg font-semibold">
              {formulaire.titre_formulaire}
            </h2>
            <p className="mt-1 text-xs text-site-muted">
              {formulaire.date_limite
                ? `À remplir avant le ${jour.format(lireJour(formulaire.date_limite))}`
                : "Sans date limite"}
              {formulaire.reponse_unique && " · Une seule réponse possible"}
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            disabled={envoi}
            aria-label="Fermer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink disabled:opacity-40"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {champs.map((c, i) => {
            const id = `champ-${c.nom}`;
            const erreur = erreurs[c.nom];
            const v = valeurs[c.nom];
            return (
              <div key={c.nom}>
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
                  {c.libelle}
                  {c.obligatoire && (
                    <span className="ml-1 text-site-danger" aria-label="obligatoire">
                      *
                    </span>
                  )}
                </label>

                {(c.type === "texte" || c.type === "nombre" || c.type === "date") && (
                  <input
                    id={id}
                    type={c.type === "texte" ? "text" : c.type === "nombre" ? "number" : "date"}
                    step={c.type === "nombre" ? "any" : undefined}
                    maxLength={c.type === "texte" ? 255 : undefined}
                    value={(v as string) ?? ""}
                    onChange={(e) => modifier(c.nom, e.target.value)}
                    autoFocus={i === 0}
                    aria-invalid={erreur ? true : undefined}
                    className={cn(CHAMP, erreur && "border-site-danger")}
                  />
                )}

                {c.type === "texte_long" && (
                  <textarea
                    id={id}
                    rows={4}
                    maxLength={5000}
                    value={(v as string) ?? ""}
                    onChange={(e) => modifier(c.nom, e.target.value)}
                    aria-invalid={erreur ? true : undefined}
                    className={cn(CHAMP, "h-auto min-h-24 resize-y py-2", erreur && "border-site-danger")}
                  />
                )}

                {c.type === "choix_unique" && (
                  <div id={id} role="radiogroup" aria-label={c.libelle} className="space-y-2">
                    {(c.options ?? []).map((o) => (
                      <label
                        key={o}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-site-line bg-site-base/40 px-4 py-2.5 text-sm"
                      >
                        <input
                          type="radio"
                          name={id}
                          checked={v === o}
                          onChange={() => modifier(c.nom, o)}
                          className="size-4 shrink-0 accent-brand-violet"
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                )}

                {c.type === "choix_multiple" && (
                  <div id={id} role="group" aria-label={c.libelle} className="space-y-2">
                    {(c.options ?? []).map((o) => (
                      <label
                        key={o}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-site-line bg-site-base/40 px-4 py-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={Array.isArray(v) && v.includes(o)}
                          onChange={() => basculer(c.nom, o)}
                          className="size-4 shrink-0 accent-brand-violet"
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                )}

                {erreur && (
                  <p role="alert" className="mt-1.5 text-xs text-site-danger">
                    {erreur}
                  </p>
                )}
              </div>
            );
          })}

          {erreurGlobale && (
            <p
              role="alert"
              className="rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger"
            >
              {erreurGlobale}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-site-line px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onFermer}
            disabled={envoi}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-medium transition-colors hover:border-brand-violet/60 disabled:opacity-50"
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
            {envoi ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
            {envoi ? "Envoi…" : "Envoyer"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function MesFormulaires() {
  const { profil, token, expirer } = useEspace();
  const gestionnaire = profil.permissions.includes("formulaires.gerer");

  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [ouverture, setOuverture] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState<FormulaireInterne | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const charger = useCallback(
    (jeton: string) => {
      void version;
      return api<Pagination<Element>>(`/formulaires?page=${page}${gestionnaire ? "&statut=publie" : ""}`, {
        token: jeton,
      });
    },
    [page, gestionnaire, version],
  );
  const liste = useDonnees(true, charger);
  const res = liste.donnees;

  async function ouvrir(f: Element) {
    setOuverture(f.id);
    try {
      setOuvert(await api<FormulaireInterne>(`/formulaires/${f.id}`, { token }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setOuverture(null);
    }
  }

  const fermer = useCallback(() => setOuvert(null), []);

  function apresEnvoi() {
    const titre = ouvert?.titre_formulaire ?? "le formulaire";
    setOuvert(null);
    setNotice({ type: "ok", texte: `Votre réponse à « ${titre} » a été enregistrée.` });
    setVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Mes formulaires</h1>
        <p className="mt-1 text-sm text-site-muted">Les formulaires de votre entreprise à remplir.</p>
      </header>

      {notice && (
        <p
          role={notice.type === "erreur" ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-site-danger/40 bg-site-danger/10 text-site-danger",
          )}
        >
          {notice.texte}
        </p>
      )}

      {liste.chargement ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Squelette key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : liste.erreur || !res ? (
        <div className="rounded-2xl border border-site-line bg-site-surface p-8 text-center text-sm text-site-muted">
          Impossible de charger les formulaires.{" "}
          <button type="button" onClick={liste.reessayer} className="font-medium text-brand-violet hover:underline">
            Réessayer
          </button>
        </div>
      ) : res.data.length === 0 ? (
        <div className="rounded-2xl border border-site-line bg-site-surface p-10 text-center text-sm text-site-muted">
          <ClipboardList size={28} className="mx-auto mb-3 opacity-60" aria-hidden />
          Aucun formulaire à remplir pour le moment.
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {res.data.map((f) => {
              const ferme = estDepasse(f.date_limite);
              const bloque = f.deja_repondu === true && f.reponse_unique;
              const ouvrable = !ferme && !bloque;
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-site-line bg-site-surface p-5 shadow-sm"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                    <ClipboardList size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.titre_formulaire}</p>
                    <p className="mt-0.5 text-xs text-site-muted">
                      {f.date_limite ? `Avant le ${jour.format(lireJour(f.date_limite))}` : "Sans date limite"}
                      {f.auteur && ` · ${f.auteur.prenom} ${f.auteur.nom}`}
                    </p>
                  </div>

                  {f.deja_repondu && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} aria-hidden />
                      Déjà rempli
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => ouvrir(f)}
                    disabled={!ouvrable || ouverture !== null}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                      ouvrable ? "v-gradient-btn" : "border border-site-line text-site-muted",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    {ouverture === f.id && <Loader2 size={14} className="animate-spin" aria-hidden />}
                    {ferme ? "Fermé" : bloque ? "Terminé" : f.deja_repondu ? "Remplir à nouveau" : "Remplir"}
                  </button>
                </li>
              );
            })}
          </ul>

          {res.last_page > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={res.current_page <= 1}
                className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40"
                aria-label="Page précédente"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span className="text-site-muted">
                Page {res.current_page} sur {res.last_page}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(res.last_page, p + 1))}
                disabled={res.current_page >= res.last_page}
                className="flex size-9 items-center justify-center rounded-lg border border-site-line transition-colors hover:border-brand-violet/60 disabled:opacity-40"
                aria-label="Page suivante"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}

      {ouvert && <Remplissage formulaire={ouvert} onFermer={fermer} onEnvoye={apresEnvoi} />}
    </div>
  );
}

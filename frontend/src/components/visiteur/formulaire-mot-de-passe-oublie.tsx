"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { Champ, Saisie, SaisieMotDePasse } from "./champs";
import { classeBouton } from "./button-link";
import { SaisieCode, useDelaiRenvoi } from "./saisie-code";

type Etape = "email" | "code" | "fini";

const REGLE_MOT_DE_PASSE = "10 caractères minimum, avec des lettres et des chiffres.";

export function FormulaireMotDePasseOublie() {
  const [etape, setEtape] = useState<Etape>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const { reste, demarrer } = useDelaiRenvoi(60);

  async function envoyerCode(e?: FormEvent) {
    e?.preventDefault();
    setErreur(null);
    setErreurs({});
    const adresse = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(adresse)) {
      setErreurs({ email: "Adresse e-mail invalide." });
      return;
    }
    setEnvoi(true);
    try {
      const r = await api<{ message: string }>("/mot-de-passe/oublie", {
        method: "POST",
        body: JSON.stringify({ email: adresse }),
      });
      setEmail(adresse);
      setInfo(r.message);
      setCode("");
      demarrer();
      setEtape("code");
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function reinitialiser(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const locales: Record<string, string> = {};
    if (!/^\d{6}$/.test(code)) locales.code = "Saisissez les 6 chiffres reçus par e-mail.";
    if (motDePasse.length < 10 || !/[A-Za-z]/.test(motDePasse) || !/\d/.test(motDePasse))
      locales.mot_de_passe = REGLE_MOT_DE_PASSE;
    else if (motDePasse !== confirmation) locales.confirmation = "Les mots de passe ne correspondent pas.";
    setErreurs(locales);
    if (Object.keys(locales).length > 0) return;

    setEnvoi(true);
    try {
      await api("/mot-de-passe/reinitialiser", {
        method: "POST",
        body: JSON.stringify({
          email,
          code,
          mot_de_passe: motDePasse,
          mot_de_passe_confirmation: confirmation,
        }),
      });
      setEtape("fini");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const serveur: Record<string, string> = {};
        for (const [champ, messages] of Object.entries(err.errors)) serveur[champ] = messages[0];
        setErreurs(serveur);
      } else {
        setErreur(messageErreur(err));
      }
    } finally {
      setEnvoi(false);
    }
  }

  const carte = "mx-auto w-full max-w-md rounded-2xl border border-site-line bg-site-surface p-6 sm:p-8";
  const alerte = "rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger";

  if (etape === "fini") {
    return (
      <section className={`${carte} text-center`}>
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cyan/15 text-brand-cyan">
          <Check size={28} strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">Mot de passe modifié</h1>
        <p className="mt-2 text-sm text-site-muted">
          Vos autres sessions ont été fermées. Connectez-vous avec votre nouveau mot de passe.
        </p>
        <Link href="/connexion" className={classeBouton("primary", "md", "mt-7 w-full")}>
          Se connecter
        </Link>
      </section>
    );
  }

  return (
    <section className={carte}>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Mot de passe oublié</h1>

      {etape === "email" ? (
        <>
          <p className="mt-2 text-sm text-site-muted">
            Indiquez l&apos;adresse e-mail de votre compte : nous vous enverrons un code à 6 chiffres.
          </p>
          <form onSubmit={envoyerCode} noValidate className="mt-7 space-y-5">
            <Champ id="email" label="Adresse e-mail" erreur={erreurs.email}>
              <Saisie
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                erreur={erreurs.email}
              />
            </Champ>
            {erreur && (
              <p role="alert" className={alerte}>
                {erreur}
              </p>
            )}
            <button type="submit" disabled={envoi} className={classeBouton("primary", "md", "w-full")}>
              {envoi && <Loader2 size={18} className="animate-spin" />}
              {envoi ? "Envoi…" : "Recevoir le code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-site-muted">
            Saisissez le code envoyé à <span className="font-semibold text-site-ink">{email}</span>, puis choisissez
            un nouveau mot de passe.
          </p>
          {info && <p className="mt-4 rounded-xl bg-site-base px-4 py-3 text-xs text-site-muted">{info}</p>}
          <form onSubmit={reinitialiser} noValidate className="mt-6 space-y-5">
            <Champ id="code" label="Code à 6 chiffres" aide="Valable 10 minutes." erreur={erreurs.code}>
              <SaisieCode id="code" value={code} onChange={setCode} erreur={erreurs.code} />
            </Champ>
            <Champ id="mot_de_passe" label="Nouveau mot de passe" aide={REGLE_MOT_DE_PASSE} erreur={erreurs.mot_de_passe}>
              <SaisieMotDePasse
                id="mot_de_passe"
                autoComplete="new-password"
                aide
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                erreur={erreurs.mot_de_passe}
              />
            </Champ>
            <Champ id="confirmation" label="Confirmez le mot de passe" erreur={erreurs.confirmation}>
              <SaisieMotDePasse
                id="confirmation"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                erreur={erreurs.confirmation}
              />
            </Champ>
            {erreur && (
              <p role="alert" className={alerte}>
                {erreur}
              </p>
            )}
            <button type="submit" disabled={envoi} className={classeBouton("primary", "md", "w-full")}>
              {envoi && <Loader2 size={18} className="animate-spin" />}
              {envoi ? "Modification…" : "Changer le mot de passe"}
            </button>
            <button
              type="button"
              disabled={reste > 0 || envoi}
              onClick={() => void envoyerCode()}
              className="w-full text-center text-sm font-medium text-brand-violet hover:underline disabled:cursor-not-allowed disabled:text-site-muted disabled:no-underline"
            >
              {reste > 0 ? `Renvoyer le code dans ${reste} s` : "Renvoyer le code"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-site-muted">
        <Link href="/connexion" className="font-medium text-brand-violet hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </section>
  );
}

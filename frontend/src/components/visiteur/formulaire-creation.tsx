"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Blocks, Building2, Check, Loader2, Lock, UserRound } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { iconeModule } from "@/lib/module-icons";
import type { ModuleCatalogue } from "@/lib/modules";
import { enregistrerToken } from "@/lib/session";
import { Champ, Saisie, SaisieMotDePasse } from "./champs";
import { ButtonLink, classeBouton } from "./button-link";
import { Turnstile } from "./turnstile";

const CAPTCHA_ACTIF = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

const schema = z
  .object({
    nom_entreprise: z.string().trim().min(2, "Indiquez le nom de l'entreprise.").max(100, "100 caractères maximum."),
    prenom: z.string().trim().min(1, "Indiquez votre prénom.").max(60, "60 caractères maximum."),
    nom: z.string().trim().min(1, "Indiquez votre nom.").max(50, "50 caractères maximum."),
    email: z
      .string()
      .trim()
      .pipe(z.email("Adresse e-mail invalide."))
      .pipe(z.string().max(100, "100 caractères maximum.")),
    mot_de_passe: z
      .string()
      .min(10, "10 caractères minimum.")
      .regex(/[A-Za-z]/, "Au moins une lettre.")
      .regex(/\d/, "Au moins un chiffre."),
    confirmation: z.string().min(1, "Confirmez le mot de passe."),
    modules: z.array(z.string()),
  })
  .refine((d) => d.mot_de_passe === d.confirmation, {
    path: ["confirmation"],
    message: "Les mots de passe ne correspondent pas.",
  });

type Valeurs = z.infer<typeof schema>;

const ETAPES = [
  { titre: "Votre entreprise", icone: Building2, champs: ["nom_entreprise"] as (keyof Valeurs)[] },
  {
    titre: "Compte administrateur",
    icone: UserRound,
    champs: ["prenom", "nom", "email", "mot_de_passe", "confirmation"] as (keyof Valeurs)[],
  },
  { titre: "Vos modules", icone: Blocks, champs: ["modules"] as (keyof Valeurs)[] },
];

type Reponse = {
  message: string;
  entreprise: { nom: string; slug: string };
  modules_actifs: string[];
  token: string;
};

function etapeDuChamp(champ: string): number {
  const base = champ.split(".")[0];
  const i = ETAPES.findIndex((e) => (e.champs as string[]).includes(base));
  return i === -1 ? ETAPES.length - 1 : i;
}

export function FormulaireCreation({ modules }: { modules: ModuleCatalogue[] }) {
  const obligatoires = modules.filter((m) => m.module_obligatoire);
  const optionnels = modules.filter((m) => !m.module_obligatoire);

  const [etape, setEtape] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Reponse | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Valeurs>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      nom_entreprise: "",
      prenom: "",
      nom: "",
      email: "",
      mot_de_passe: "",
      confirmation: "",
      modules: [],
    },
  });

  const choisis = watch("modules");

  function basculer(code: string) {
    setValue("modules", choisis.includes(code) ? choisis.filter((c) => c !== code) : [...choisis, code], {
      shouldDirty: true,
    });
  }

  async function suivant() {
    if (await trigger(ETAPES[etape].champs)) {
      setErreurGlobale(null);
      setEtape((e) => e + 1);
    }
  }

  async function envoyer(v: Valeurs) {
    if (CAPTCHA_ACTIF && !captcha) {
      setErreurGlobale("Confirmez que vous n'êtes pas un robot.");
      return;
    }
    setErreurGlobale(null);
    setEnvoi(true);
    try {
      const reponse = await api<Reponse>("/intranets", {
        method: "POST",
        body: JSON.stringify({
          nom_entreprise: v.nom_entreprise,
          prenom: v.prenom,
          nom: v.nom,
          email: v.email,
          mot_de_passe: v.mot_de_passe,
          modules: v.modules,
          turnstile_token: captcha,
        }),
      });
      enregistrerToken(reponse.token);
      setResultat(reponse);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const champs = Object.entries(err.errors);
        let premiere = ETAPES.length - 1;
        for (const [champ, messages] of champs) {
          const base = champ.split(".")[0] as keyof Valeurs;
          premiere = Math.min(premiere, etapeDuChamp(champ));
          if (base === "modules") {
            setErreurGlobale(messages[0]);
          } else {
            setError(base, { message: messages[0] });
          }
        }
        setEtape(premiere);
      } else {
        setErreurGlobale(messageErreur(err));
      }
    } finally {
      setEnvoi(false);
    }
  }

  function surEnvoi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (etape < ETAPES.length - 1) {
      void suivant();
      return;
    }
    void handleSubmit(envoyer)(e);
  }

  if (resultat) {
    const actifs = modules.filter((m) => resultat.modules_actifs.includes(m.code_module));
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-site-line bg-site-surface p-8 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cyan/15 text-brand-cyan">
          <Check size={28} strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Votre intranet est créé</h1>
        <p className="mt-3 text-site-muted">
          L&apos;espace de <span className="font-semibold text-site-ink">{resultat.entreprise.nom}</span> est prêt.
          Identifiant : <span className="font-mono text-site-ink">{resultat.entreprise.slug}</span>
        </p>

        <div className="mt-7 text-left">
          <p className="mb-3 text-sm font-medium">Modules activés ({actifs.length})</p>
          <ul className="flex flex-wrap gap-2">
            {actifs.map((m) => {
              const Icone = iconeModule(m.code_module);
              return (
                <li
                  key={m.code_module}
                  className="flex items-center gap-1.5 rounded-full border border-site-line bg-site-base px-3 py-1.5 text-xs text-site-muted"
                >
                  <Icone size={14} />
                  {m.nom_module}
                </li>
              );
            })}
          </ul>
        </div>

        <ButtonLink href="/espace" className="mt-9 w-full sm:w-auto">
          Accéder à mon espace
          <ArrowRight size={18} />
        </ButtonLink>
      </section>
    );
  }

  const dernier = etape === ETAPES.length - 1;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
      <aside>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Créez votre intranet</h1>
        <p className="mt-3 text-site-muted">Trois étapes, quelques minutes. Vous pourrez tout modifier ensuite.</p>

        <ol className="mt-8 hidden space-y-3 lg:block">
          {ETAPES.map(({ titre, icone: Icone }, i) => {
            const fait = i < etape;
            const courant = i === etape;
            return (
              <li
                key={titre}
                aria-current={courant ? "step" : undefined}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  courant ? "border-brand-violet/60 bg-site-surface" : "border-site-line"
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    fait
                      ? "bg-brand-cyan/15 text-brand-cyan"
                      : courant
                        ? "v-gradient-btn"
                        : "bg-site-surface2 text-site-muted"
                  }`}
                >
                  {fait ? <Check size={16} strokeWidth={2.5} /> : <Icone size={16} />}
                </span>
                <span className={courant ? "font-semibold" : "text-site-muted"}>{titre}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="rounded-2xl border border-site-line bg-site-surface p-6 sm:p-8">
        <p className="mb-6 text-sm text-site-muted">
          Étape {etape + 1} sur {ETAPES.length} ·{" "}
          <span className="font-medium text-site-ink">{ETAPES[etape].titre}</span>
        </p>

        <form onSubmit={surEnvoi} noValidate className="space-y-5">
          {etape === 0 && (
            <Champ id="nom_entreprise" label="Nom de l'entreprise" erreur={errors.nom_entreprise?.message}>
              <Saisie
                id="nom_entreprise"
                autoComplete="organization"
                placeholder="Ex. Société Malagasy Export"
                erreur={errors.nom_entreprise?.message}
                {...register("nom_entreprise")}
              />
            </Champ>
          )}

          {etape === 1 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Champ id="prenom" label="Prénom" erreur={errors.prenom?.message}>
                  <Saisie
                    id="prenom"
                    autoComplete="given-name"
                    erreur={errors.prenom?.message}
                    {...register("prenom")}
                  />
                </Champ>
                <Champ id="nom" label="Nom" erreur={errors.nom?.message}>
                  <Saisie id="nom" autoComplete="family-name" erreur={errors.nom?.message} {...register("nom")} />
                </Champ>
              </div>
              <Champ id="email" label="Adresse e-mail" erreur={errors.email?.message}>
                <Saisie
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@entreprise.mg"
                  erreur={errors.email?.message}
                  {...register("email")}
                />
              </Champ>
              <Champ
                id="mot_de_passe"
                label="Mot de passe"
                aide="10 caractères minimum, avec des lettres et des chiffres."
                erreur={errors.mot_de_passe?.message}
              >
                <SaisieMotDePasse
                  id="mot_de_passe"
                  autoComplete="new-password"
                  aide
                  erreur={errors.mot_de_passe?.message}
                  {...register("mot_de_passe")}
                />
              </Champ>
              <Champ id="confirmation" label="Confirmer le mot de passe" erreur={errors.confirmation?.message}>
                <SaisieMotDePasse
                  id="confirmation"
                  autoComplete="new-password"
                  erreur={errors.confirmation?.message}
                  {...register("confirmation")}
                />
              </Champ>
            </>
          )}

          {etape === 2 && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Toujours inclus</p>
                <ul className="flex flex-wrap gap-2">
                  {obligatoires.map((m) => {
                    const Icone = iconeModule(m.code_module);
                    return (
                      <li
                        key={m.code_module}
                        className="flex items-center gap-1.5 rounded-full border border-site-line bg-site-base px-3 py-1.5 text-xs text-site-muted"
                      >
                        <Lock size={12} />
                        <Icone size={14} />
                        {m.nom_module}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <fieldset>
                <legend className="mb-3 text-sm font-medium">Modules à activer (facultatif)</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {optionnels.map((m) => {
                    const Icone = iconeModule(m.code_module);
                    const actif = choisis.includes(m.code_module);
                    return (
                      <label
                        key={m.code_module}
                        className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-violet ${
                          actif
                            ? "border-brand-violet bg-brand-violet/10"
                            : "border-site-line hover:border-brand-violet/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={actif}
                          onChange={() => basculer(m.code_module)}
                        />
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                            actif ? "v-gradient-btn border-transparent" : "border-site-line bg-site-base"
                          }`}
                        >
                          {actif && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <Icone size={15} className="text-brand-violet" />
                            {m.nom_module}
                          </span>
                          <span className="mt-0.5 block text-xs text-site-muted">{m.description_module}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {erreurGlobale && (
            <p
              role="alert"
              className="rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger"
            >
              {erreurGlobale}
            </p>
          )}

          {dernier && CAPTCHA_ACTIF ? <Turnstile onToken={setCaptcha} /> : null}

          <div className="flex items-center justify-between gap-3 pt-2">
            {etape > 0 ? (
              <button type="button" onClick={() => setEtape((e) => e - 1)} className={classeBouton("secondary", "sm")}>
                <ArrowLeft size={16} />
                Retour
              </button>
            ) : (
              <Link href="/" className="text-sm text-site-muted transition-colors hover:text-site-ink">
                Annuler
              </Link>
            )}

            {dernier ? (
              <button type="submit" disabled={envoi} className={classeBouton("primary", "md")}>
                {envoi ? <Loader2 size={18} className="animate-spin" /> : null}
                {envoi ? "Création en cours…" : "Créer mon intranet"}
              </button>
            ) : (
              <button type="submit" className={classeBouton("primary", "md")}>
                Continuer
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { enregistrerToken } from "@/lib/session";
import { Champ, Saisie, SaisieMotDePasse } from "./champs";
import { classeBouton } from "./button-link";

const schema = z.object({
  email: z.string().trim().pipe(z.email("Adresse e-mail invalide.")),
  mot_de_passe: z.string().min(1, "Saisissez votre mot de passe."),
});

type Valeurs = z.infer<typeof schema>;

export function FormulaireConnexion() {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Valeurs>({ resolver: zodResolver(schema), mode: "onTouched" });

  async function envoyer(v: Valeurs) {
    setErreur(null);
    try {
      const reponse = await api<{ token: string }>("/login", { method: "POST", body: JSON.stringify(v) });
      enregistrerToken(reponse.token);
      router.push("/espace");
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-site-line bg-site-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Connexion</h1>
      <p className="mt-2 text-sm text-site-muted">Accédez à l&apos;intranet de votre entreprise.</p>

      <form onSubmit={handleSubmit(envoyer)} noValidate className="mt-7 space-y-5">
        <Champ id="email" label="Adresse e-mail" erreur={errors.email?.message}>
          <Saisie id="email" type="email" autoComplete="email" erreur={errors.email?.message} {...register("email")} />
        </Champ>
        <Champ id="mot_de_passe" label="Mot de passe" erreur={errors.mot_de_passe?.message}>
          <SaisieMotDePasse
            id="mot_de_passe"
            autoComplete="current-password"
            erreur={errors.mot_de_passe?.message}
            {...register("mot_de_passe")}
          />
        </Champ>

        {erreur && (
          <p
            role="alert"
            className="rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger"
          >
            {erreur}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className={classeBouton("primary", "md", "w-full")}>
          {isSubmitting && <Loader2 size={18} className="animate-spin" />}
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-site-muted">
        Pas encore d&apos;intranet ?{" "}
        <Link href="/creer-intranet" className="font-medium text-brand-violet hover:underline">
          Créer le vôtre
        </Link>
      </p>
    </section>
  );
}

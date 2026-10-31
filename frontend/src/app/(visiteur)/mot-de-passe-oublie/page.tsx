import type { Metadata } from "next";
import { SiteHeader } from "@/components/visiteur/site-header";
import { FormulaireMotDePasseOublie } from "@/components/visiteur/formulaire-mot-de-passe-oublie";

export const metadata: Metadata = {
  title: "Mot de passe oublié — CMS Intranet",
  description: "Réinitialisez votre mot de passe avec un code reçu par e-mail.",
};

export default function MotDePasseOublie() {
  return (
    <>
      <SiteHeader simple lien={{ href: "/connexion", label: "Se connecter" }} />
      <main className="v-noise flex min-h-screen items-center px-6 pb-16 pt-28">
        <FormulaireMotDePasseOublie />
      </main>
    </>
  );
}

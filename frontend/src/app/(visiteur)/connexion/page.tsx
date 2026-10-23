import type { Metadata } from "next";
import { SiteHeader } from "@/components/visiteur/site-header";
import { FormulaireConnexion } from "@/components/visiteur/formulaire-connexion";

export const metadata: Metadata = {
  title: "Connexion — CMS Intranet",
  description: "Connectez-vous à l'intranet de votre entreprise.",
};

export default function Connexion() {
  return (
    <>
      <SiteHeader simple lien={{ href: "/creer-intranet", label: "Créer mon intranet" }} />
      <main className="v-noise flex min-h-screen items-center px-6 pb-16 pt-28">
        <FormulaireConnexion />
      </main>
    </>
  );
}

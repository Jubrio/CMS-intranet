import type { Metadata } from "next";
import { getCatalogue } from "@/lib/modules";
import { SiteHeader } from "@/components/visiteur/site-header";
import { FormulaireCreation } from "@/components/visiteur/formulaire-creation";

export const metadata: Metadata = {
  title: "Créer mon intranet — CMS Intranet",
  description: "Créez l'intranet de votre entreprise en 3 étapes.",
};

export const revalidate = 300;

export default async function CreerIntranet() {
  const modules = await getCatalogue();

  return (
    <>
      <SiteHeader simple lien={{ href: "/connexion", label: "Se connecter" }} />
      <main className="v-noise min-h-screen px-6 pb-20 pt-32 lg:px-10">
        <FormulaireCreation modules={modules} />
      </main>
    </>
  );
}

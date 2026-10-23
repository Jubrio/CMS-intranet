import { getCatalogue } from "@/lib/modules";
import { BarreProgression, Mouvement } from "@/components/visiteur/reveal";
import { SiteHeader } from "@/components/visiteur/site-header";
import { SiteFooter } from "@/components/visiteur/site-footer";
import { Hero } from "@/components/visiteur/sections/hero";
import { BandeauModules } from "@/components/visiteur/sections/bandeau-modules";
import { Probleme } from "@/components/visiteur/sections/probleme";
import { Fonctionnalites } from "@/components/visiteur/sections/fonctionnalites";
import { Modules } from "@/components/visiteur/sections/modules";
import { Etapes } from "@/components/visiteur/sections/etapes";
import { Apercu } from "@/components/visiteur/sections/apercu";
import { Avantages } from "@/components/visiteur/sections/avantages";
import { Faq } from "@/components/visiteur/sections/faq";
import { AppelFinal } from "@/components/visiteur/sections/appel-final";

// Le catalogue est relu au plus toutes les 5 minutes
export const revalidate = 300;

export default async function Accueil() {
  const modules = await getCatalogue();

  return (
    <Mouvement>
      <BarreProgression />
      <SiteHeader />
      <main>
        <Hero nombreModules={modules.length} />
        <BandeauModules modules={modules} />
        <Probleme />
        <Fonctionnalites />
        <Modules modules={modules} />
        <Etapes />
        <Apercu />
        <Avantages />
        <Faq />
        <AppelFinal />
      </main>
      <SiteFooter />
    </Mouvement>
  );
}

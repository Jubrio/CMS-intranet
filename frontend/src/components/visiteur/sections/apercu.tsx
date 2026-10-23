import { DashboardPreview } from "../dashboard-preview";
import { Reveal } from "../reveal";

export function Apercu() {
  return (
    <section id="apercu" className="v-noise px-6 py-24 lg:px-10">
      <Reveal className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Toute l&apos;information. Au même endroit.</h2>
        <p className="mx-auto mt-4 max-w-xl text-site-muted">
          Un espace unique où chaque employé retrouve ce qui le concerne : actualités, documents, annuaire et
          formulaires.
        </p>
        <div className="mt-14">
          <DashboardPreview />
        </div>
        <p className="mt-4 text-xs text-site-muted">Aperçu illustratif de l&apos;interface.</p>
      </Reveal>
    </section>
  );
}

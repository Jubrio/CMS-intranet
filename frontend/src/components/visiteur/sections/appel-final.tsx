import { ButtonLink } from "../button-link";
import { Reveal } from "../reveal";

export function AppelFinal() {
  return (
    <section className="v-noise border-t border-site-line/60 px-6 py-28 lg:px-10">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Prêt à lancer l&apos;intranet de votre entreprise ?
        </h2>
        <p className="mt-4 text-site-muted">
          Créez votre espace en quelques minutes et choisissez les modules qui vous conviennent.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <ButtonLink href="/creer-intranet">Créer mon intranet</ButtonLink>
          <ButtonLink href="/connexion" variante="secondary">
            Se connecter
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}

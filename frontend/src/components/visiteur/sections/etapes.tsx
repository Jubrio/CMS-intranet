import { Blocks, Building2, UserRound } from "lucide-react";
import { ButtonLink } from "../button-link";
import { Reveal, RevealItem } from "../reveal";

const ETAPES = [
  {
    icone: Building2,
    titre: "Votre entreprise",
    texte: "Indiquez le nom de l'entreprise. Son espace intranet est créé immédiatement.",
  },
  {
    icone: UserRound,
    titre: "Votre compte administrateur",
    texte: "Renseignez vos informations : vous gérez ensuite les utilisateurs, les rôles et les contenus.",
  },
  {
    icone: Blocks,
    titre: "Vos modules",
    texte: "Sélectionnez les modules à activer. Vous pourrez en changer plus tard.",
  },
];

export function Etapes() {
  return (
    <section id="etapes" className="px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Prêt en 3 étapes</h2>
          <p className="mt-4 text-site-muted">Aucune installation : tout se passe dans votre navigateur.</p>
        </Reveal>

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {ETAPES.map(({ icone: Icone, titre, texte }, i) => (
            <RevealItem
              key={titre}
              delay={i * 0.12}
              className="relative rounded-2xl border border-site-line bg-site-surface p-7"
            >
              <span className="v-gradient-btn absolute -top-4 left-7 flex size-8 items-center justify-center rounded-full font-display text-sm font-bold">
                {i + 1}
              </span>
              <span className="mt-2 flex size-11 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
                <Icone size={22} strokeWidth={2} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-site-muted">{texte}</p>
            </RevealItem>
          ))}
        </ol>

        <div className="mt-12 text-center">
          <ButtonLink href="/creer-intranet">Commencer maintenant</ButtonLink>
        </div>
      </div>
    </section>
  );
}

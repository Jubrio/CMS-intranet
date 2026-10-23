import { Blocks, CheckCheck, Lock, Network, Palette, ShieldCheck } from "lucide-react";
import { Reveal, RevealItem } from "../reveal";

const FONCTIONNALITES = [
  {
    icone: Blocks,
    titre: "Modules à la carte",
    texte: "Actualités, documents, annuaire, formulaires… Activez ou désactivez chaque module selon vos besoins.",
  },
  {
    icone: ShieldCheck,
    titre: "Rôles et permissions",
    texte: "Définissez qui peut consulter, publier ou gérer, module par module.",
  },
  {
    icone: Network,
    titre: "Départements et ciblage",
    texte: "Publiez pour toute l'entreprise ou pour un seul département. Un manager reste dans son périmètre.",
  },
  {
    icone: CheckCheck,
    titre: "Confirmation de lecture",
    texte: "Pour les notes de service, chaque destinataire confirme sa lecture et vous suivez qui a lu.",
  },
  {
    icone: Palette,
    titre: "Votre identité",
    texte: "Logo, couleurs et menus : l'intranet prend l'apparence de votre entreprise.",
  },
  {
    icone: Lock,
    titre: "Données isolées",
    texte: "Chaque entreprise dispose de son propre espace. Les contenus ne sont jamais partagés entre intranets.",
  },
];

export function Fonctionnalites() {
  return (
    <section id="fonctionnalites" className="px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-xl">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Tout ce qu&apos;il faut pour animer votre entreprise
          </h2>
          <p className="mt-4 text-site-muted">Une base solide, pensée pour s&apos;adapter à votre organisation.</p>
        </Reveal>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FONCTIONNALITES.map(({ icone: Icone, titre, texte }, i) => (
            <RevealItem key={titre} delay={(i % 3) * 0.1}>
              <div className="v-card-hover h-full rounded-2xl border border-site-line bg-site-surface p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-violet/15 text-brand-violet">
                <Icone size={20} strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-site-muted">{texte}</p>
              </div>
            </RevealItem>
          ))}
        </ul>
      </div>
    </section>
  );
}

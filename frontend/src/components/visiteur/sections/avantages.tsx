import { Rocket, ShieldCheck, SlidersHorizontal, Target } from "lucide-react";
import { Reveal, RevealItem } from "../reveal";

const AVANTAGES = [
  { icone: Rocket, titre: "Plus simple", texte: "Un intranet opérationnel en 3 étapes." },
  { icone: Target, titre: "Plus ciblé", texte: "Chaque message atteint le bon public." },
  { icone: ShieldCheck, titre: "Plus sûr", texte: "Permissions précises et données isolées." },
  { icone: SlidersHorizontal, titre: "Plus flexible", texte: "Activez les modules selon l'évolution de vos besoins." },
];

export function Avantages() {
  return (
    <section className="px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
            Pourquoi choisir CMS Intranet ?
          </h2>
        </Reveal>
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AVANTAGES.map(({ icone: Icone, titre, texte }, i) => (
            <RevealItem key={titre} delay={i * 0.1} className="p-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
                <Icone size={22} strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{titre}</h3>
              <p className="mt-2 text-sm text-site-muted">{texte}</p>
            </RevealItem>
          ))}
        </ul>
      </div>
    </section>
  );
}

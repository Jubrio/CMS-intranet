"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Reveal } from "../reveal";

const QUESTIONS = [
  {
    q: "Qu'est-ce que CMS Intranet ?",
    r: "Une plateforme web qui permet à une entreprise de créer et de gérer son propre intranet : publication d'actualités, partage de documents, annuaire, formulaires internes et bien plus.",
  },
  {
    q: "Dois-je installer quelque chose ?",
    r: "Non. Tout se passe dans le navigateur : vous créez votre intranet en quelques étapes, puis vous invitez vos collaborateurs.",
  },
  {
    q: "Puis-je choisir les fonctionnalités dont j'ai besoin ?",
    r: "Oui. Les modules de base (utilisateurs, rôles, personnalisation) sont toujours inclus. Tous les autres s'activent ou se désactivent selon vos besoins, à la création comme plus tard.",
  },
  {
    q: "Mes données sont-elles séparées de celles des autres entreprises ?",
    r: "Oui. Chaque entreprise dispose de son propre espace : ses utilisateurs, ses contenus et ses documents ne sont visibles que par elle.",
  },
  {
    q: "Qui peut publier des contenus ?",
    r: "Cela dépend des rôles et des permissions que vous définissez. Un manager, par exemple, ne publie que pour son département.",
  },
  {
    q: "Puis-je personnaliser l'apparence ?",
    r: "Oui. L'administrateur peut configurer le logo, les couleurs et les menus de l'intranet pour qu'il reflète l'identité de l'entreprise.",
  },
];

export function Faq() {
  const [ouvert, setOuvert] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Questions fréquentes</h2>
        </Reveal>
        <div className="mt-12 space-y-3">
          {QUESTIONS.map((item, i) => {
            const estOuvert = ouvert === i;
            return (
              <div key={item.q} className="rounded-xl border border-site-line bg-site-surface">
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={estOuvert}
                    aria-controls={`faq-r-${i}`}
                    onClick={() => setOuvert(estOuvert ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-medium"
                  >
                    {item.q}
                    <Plus
                      size={20}
                      className={`shrink-0 text-site-muted transition-transform duration-300 ${estOuvert ? "rotate-45" : ""}`}
                    />
                  </button>
                </h3>
                <div
                  id={`faq-r-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={`grid transition-[grid-template-rows] duration-300 ${estOuvert ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-site-muted">{item.r}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

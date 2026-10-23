import { X } from "lucide-react";
import { Reveal } from "../reveal";

const PROBLEMES = [
  "Les annonces se perdent dans les messageries et les groupes de discussion.",
  "Les documents sont dispersés entre plusieurs dossiers et personnes.",
  "Impossible de savoir si une note de service a bien été lue.",
];

export function Probleme() {
  return (
    <section className="px-6 py-24 lg:px-10">
      <Reveal className="mx-auto max-w-5xl text-center">
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
          Votre information interne mérite mieux que des mails en chaîne.
        </h2>
        <ul className="mt-12 grid gap-6 text-left sm:grid-cols-3">
          {PROBLEMES.map((p) => (
            <li key={p} className="rounded-2xl border border-site-line bg-site-surface p-6">
              <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-site-danger/10 text-site-danger">
                <X size={18} strokeWidth={2.5} />
              </span>
              <p className="text-site-muted">{p}</p>
            </li>
          ))}
        </ul>
        <p className="v-gradient-text mt-12 inline-block font-display text-xl font-semibold">
          CMS Intranet réunit tout au même endroit.
        </p>
      </Reveal>
    </section>
  );
}

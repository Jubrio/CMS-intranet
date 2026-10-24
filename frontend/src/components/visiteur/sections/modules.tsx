import { iconeModule } from "@/lib/module-icons";
import type { ModuleCatalogue } from "@/lib/modules";
import { Reveal, RevealItem } from "../reveal";

export function Modules({ modules }: { modules: ModuleCatalogue[] }) {
  return (
    <section id="modules" className="v-noise px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Choisissez vos modules</h2>
          <p className="mt-4 text-site-muted">
            Les modules de base sont toujours inclus. Les autres s&apos;activent à la création, et se modifient ensuite
            à tout moment.
          </p>
        </Reveal>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => {
            const Icone = iconeModule(m.code_module);
            return (
              <RevealItem
                key={m.code_module}
                delay={(i % 3) * 0.08}
                className="rounded-2xl border border-site-line bg-site-surface p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-violet/15 text-brand-violet">
                    <Icone size={20} strokeWidth={2} />
                  </span>
                  {m.module_obligatoire && (
                    <span className="rounded-full bg-brand-cyan/15 px-2.5 py-0.5 text-xs font-medium text-brand-cyan">
                      Inclus
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{m.nom_module}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-site-muted">{m.description_module}</p>
              </RevealItem>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

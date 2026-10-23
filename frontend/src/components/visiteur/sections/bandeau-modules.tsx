import { iconeModule } from "@/lib/module-icons";
import type { ModuleCatalogue } from "@/lib/modules";

// Remplace la bande de logos clients : les modules que l'on peut activer
export function BandeauModules({ modules }: { modules: ModuleCatalogue[] }) {
  const optionnels = modules.filter((m) => !m.module_obligatoire);

  return (
    <section aria-label="Modules disponibles" className="border-y border-site-line/60 py-14">
      <div className="mx-auto max-w-7xl px-6 text-center lg:px-10">
        <p className="mb-8 text-sm text-site-muted">Activez seulement ce dont vous avez besoin</p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 font-display text-base font-semibold text-site-muted/90">
          {optionnels.map((m) => {
            const Icone = iconeModule(m.code_module);
            return (
              <li key={m.code_module} className="flex items-center gap-2">
                <Icone size={18} strokeWidth={2} />
                {m.nom_module}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

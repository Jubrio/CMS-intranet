"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers } from "lucide-react";
import { menuPour, type Personnalisation, type Profil } from "@/lib/espace";
import { cn } from "@/lib/utils";

export function Sidebar({
  profil,
  perso,
  onNavigate,
}: {
  profil: Profil;
  perso: Personnalisation | null;
  onNavigate?: () => void;
}) {
  const chemin = usePathname();
  const nom = perso?.nom_entreprise ?? profil.entreprise ?? "CMS Intranet";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-site-line px-5">
        {perso?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={perso.logo_url} alt="" className="size-9 shrink-0 rounded-lg bg-site-surface2 object-contain p-1" />
        ) : (
          <span className="v-gradient-btn flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Layers size={18} strokeWidth={2.25} aria-hidden />
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-sm font-semibold">{nom}</p>
          <p className="truncate text-[11px] text-site-muted">Espace d&apos;administration</p>
        </div>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 py-4">
        {menuPour(profil).map((groupe, i) => (
          <div key={groupe.titre ?? i} className={cn(i > 0 && "mt-6")}>
            {groupe.titre && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-site-muted">{groupe.titre}</p>
            )}
            <ul className="space-y-0.5">
              {groupe.entrees.map((e) => {
                const Icone = e.icone;
                const actif = e.href !== undefined && chemin === e.href;

                if (!e.href) {
                  return (
                    <li key={e.libelle}>
                      <span
                        aria-disabled
                        className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-site-muted/70"
                      >
                        <Icone size={18} aria-hidden className="shrink-0" />
                        <span className="truncate">{e.libelle}</span>
                        <span className="ml-auto shrink-0 rounded-full border border-site-line px-2 py-0.5 text-[10px] font-medium text-site-muted">
                          Bientôt
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={e.libelle}>
                    <Link
                      href={e.href}
                      onClick={onNavigate}
                      aria-current={actif ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        actif
                          ? "bg-brand-violet/15 text-brand-violet"
                          : "text-site-muted hover:bg-site-surface2 hover:text-site-ink",
                      )}
                    >
                      {actif && <span aria-hidden className="v-gradient-btn absolute inset-y-2 left-0 w-1 rounded-r-full" />}
                      <Icone size={18} aria-hidden className="shrink-0" />
                      <span className="truncate">{e.libelle}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "./logo";

const COLONNES = [
  {
    titre: "Produit",
    liens: [
      { label: "Fonctionnalités", href: "/#fonctionnalites" },
      { label: "Modules", href: "/#modules" },
      { label: "Comment ça marche", href: "/#etapes" },
    ],
  },
  {
    titre: "Accès",
    liens: [
      { label: "Créer mon intranet", href: "/creer-intranet" },
      { label: "Se connecter", href: "/connexion" },
    ],
  },
  {
    titre: "Aide",
    liens: [{ label: "Questions fréquentes", href: "/#faq" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-site-line/60 px-6 py-16 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="mb-3" />
          <p className="max-w-xs text-sm text-site-muted">
            La plateforme pour créer et gérer l&apos;intranet de votre entreprise, module par module.
          </p>
        </div>

        {COLONNES.map((col) => (
          <div key={col.titre}>
            <p className="mb-4 font-display text-sm font-semibold">{col.titre}</p>
            <ul className="space-y-2.5 text-sm text-site-muted">
              {col.liens.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="transition-colors hover:text-site-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-14 text-center text-xs text-site-muted/80">© 2026 CMS Intranet. Projet de fin d&apos;études.</p>
    </footer>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme";
import { ButtonLink } from "./button-link";

const LIENS = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#modules", label: "Modules" },
  { href: "/#etapes", label: "Comment ça marche" },
  { href: "/#faq", label: "FAQ" },
];

type Props = {
  // Version allégée (création d'intranet, connexion) : logo, thème et un seul lien
  simple?: boolean;
  lien?: { href: string; label: string };
};

export function SiteHeader({ simple = false, lien }: Props) {
  const [defile, setDefile] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        defile || ouvert ? "v-glass border-b border-site-line" : ""
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Logo />

        {!simple && (
          <nav aria-label="Navigation principale" className="hidden items-center gap-9 text-sm font-medium text-site-muted lg:flex">
            {LIENS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-site-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {simple ? (
            lien && (
              <Link href={lien.href} className="text-sm font-medium text-site-muted transition-colors hover:text-site-ink">
                {lien.label}
              </Link>
            )
          ) : (
            <>
              <Link
                href="/connexion"
                className="hidden text-sm font-medium text-site-muted transition-colors hover:text-site-ink lg:block"
              >
                Se connecter
              </Link>
              <ButtonLink href="/creer-intranet" taille="sm" className="hidden lg:inline-flex">
                Créer mon intranet
              </ButtonLink>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-full text-site-ink lg:hidden"
                aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
                aria-expanded={ouvert}
                aria-controls="menu-mobile"
                onClick={() => setOuvert((v) => !v)}
              >
                {ouvert ? <X size={24} /> : <Menu size={24} />}
              </button>
            </>
          )}
        </div>
      </div>

      {!simple && (
        <div
          id="menu-mobile"
          inert={!ouvert}
          className={`v-glass overflow-hidden px-6 transition-[max-height] duration-300 lg:hidden ${
            ouvert ? "max-h-96 border-b border-site-line" : "max-h-0"
          }`}
        >
          <div className="flex flex-col gap-5 py-6 font-medium text-site-muted">
            {LIENS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOuvert(false)}>
                {l.label}
              </Link>
            ))}
            <hr className="border-site-line" />
            <Link href="/connexion" onClick={() => setOuvert(false)}>
              Se connecter
            </Link>
            <ButtonLink href="/creer-intranet" onClick={() => setOuvert(false)}>
              Créer mon intranet
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}

import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

// Thème choisi par le visiteur (clair/sombre), lu avant le premier affichage.
// Sans effet hors des pages visiteur : les styles ne s'appliquent qu'avec .visiteur.
const SCRIPT_THEME = `(function(){try{var t=localStorage.getItem("visiteur-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.visiteurTheme=t}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "CMS Intranet — Créez l'intranet de votre entreprise",
  description:
    "Créez et gérez l'intranet de votre entreprise : actualités, documents, annuaire, formulaires. Vous activez uniquement les modules dont vous avez besoin.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="visiteur-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
        {children}
      </body>
    </html>
  );
}

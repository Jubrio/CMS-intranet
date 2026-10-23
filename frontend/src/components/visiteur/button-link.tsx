import Link from "next/link";
import type { ComponentProps } from "react";

type Variante = "primary" | "secondary";
type Taille = "md" | "sm";

// Classes communes aux liens et aux vrais boutons (envoi de formulaire)
export function classeBouton(variante: Variante = "primary", taille: Taille = "md", extra = ""): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-60";
  const tailles = { md: "px-7 py-3.5", sm: "px-5 py-2.5 text-sm" };
  const variantes = {
    primary: "v-gradient-btn hover:opacity-95",
    secondary: "border border-site-line text-site-ink hover:border-brand-violet/60",
  };
  return `${base} ${tailles[taille]} ${variantes[variante]} ${extra}`.trim();
}

type Props = ComponentProps<typeof Link> & { variante?: Variante; taille?: Taille };

export function ButtonLink({ variante, taille, className = "", ...props }: Props) {
  return <Link className={classeBouton(variante, taille, className)} {...props} />;
}

import type { CSSProperties } from "react";

export const COULEURS_PAR_DEFAUT = { principale: "#1D4ED8", secondaire: "#475569" };
export const FORMAT_COULEUR = /^#[0-9A-Fa-f]{6}$/;

export const PALETTES = [
  { nom: "Violet et bleu", principale: "#7C3AED", secondaire: "#2563EB" },
  { nom: "Bleu et ardoise", principale: "#1D4ED8", secondaire: "#475569" },
  { nom: "Émeraude", principale: "#059669", secondaire: "#0D9488" },
  { nom: "Orange", principale: "#EA580C", secondaire: "#DC2626" },
  { nom: "Rose", principale: "#DB2777", secondaire: "#7C3AED" },
  { nom: "Ardoise", principale: "#334155", secondaire: "#64748B" },
] as const;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrasteAvecBlanc = (hex: string) => 1.05 / (luminance(hex) + 0.05);

export function variablesTheme(principale?: string | null, secondaire?: string | null): CSSProperties {
  const p = principale && FORMAT_COULEUR.test(principale) ? principale : null;
  const s = secondaire && FORMAT_COULEUR.test(secondaire) ? secondaire : null;
  const lisible = (c: string) => `light-dark(${c}, color-mix(in oklab, ${c} 60%, white))`;
  const fonce = (c: string) => `color-mix(in oklab, ${c} 82%, black)`;

  const v: Record<string, string> = {};
  if (p) {
    v["--brand-violet"] = lisible(p);
    v["--grad-text-a"] = lisible(p);
    v["--grad-btn-a"] = p;
    v["--grad-btn-ha"] = fonce(p);
  }
  if (s) {
    v["--brand-blue"] = lisible(s);
    v["--grad-text-b"] = lisible(s);
    v["--grad-btn-b"] = s;
    v["--grad-btn-hb"] = fonce(s);
  }
  return v as CSSProperties;
}

import type { ReactNode } from "react";
import { VisiteurShell } from "@/components/visiteur/theme";

// Le thème clair/sombre est posé sur <html> avant le premier affichage par un
// script du layout racine (voir app/layout.tsx), pour éviter un flash.
export default function VisiteurLayout({ children }: { children: ReactNode }) {
  return <VisiteurShell>{children}</VisiteurShell>;
}

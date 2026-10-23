import type { ReactNode } from "react";
import { VisiteurShell } from "@/components/visiteur/theme";
import { EspaceShell } from "@/components/espace/espace-shell";

// Même enveloppe que le site visiteur : le choix clair/sombre est partagé.
export default function EspaceLayout({ children }: { children: ReactNode }) {
  return (
    <VisiteurShell>
      <EspaceShell>{children}</EspaceShell>
    </VisiteurShell>
  );
}

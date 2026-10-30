import type { ReactNode } from "react";
import { VisiteurShell } from "@/components/visiteur/theme";

export default function VisiteurLayout({ children }: { children: ReactNode }) {
  return <VisiteurShell>{children}</VisiteurShell>;
}

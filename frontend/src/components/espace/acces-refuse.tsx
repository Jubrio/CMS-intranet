import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { RaisonRefus } from "@/lib/espace";

const MESSAGES: Record<RaisonRefus, { titre: string; detail: string }> = {
  role: {
    titre: "Accès non autorisé",
    detail:
      "Votre rôle n’a pas accès à cette page. Si vous pensez que c’est une erreur, contactez l’administrateur de votre intranet.",
  },
  module: {
    titre: "Fonctionnalité non activée",
    detail:
      "Cette fonctionnalité n’est pas activée pour votre entreprise. L’administrateur peut l’activer depuis l’écran « Modules ».",
  },
  menu: {
    titre: "Page retirée de votre menu",
    detail: "L’administrateur a masqué cette page pour votre profil. Contactez-le si vous en avez besoin.",
  },
};

export function AccesRefuse({ raison }: { raison: RaisonRefus }) {
  const { titre, detail } = MESSAGES[raison];
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-site-line bg-site-surface px-6 py-14 text-center shadow-sm"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
        <ShieldAlert size={22} aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-lg font-semibold">{titre}</h1>
      <p className="mt-2 text-sm text-site-muted">{detail}</p>
      <Link
        href="/espace"
        className="v-gradient-btn mt-6 inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}

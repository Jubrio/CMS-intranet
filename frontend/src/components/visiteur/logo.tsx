import Link from "next/link";
import { Layers } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="CMS Intranet, accueil"
      className={`flex items-center gap-2 font-display text-xl font-bold text-site-ink ${className}`}
    >
      <span className="v-gradient-btn flex size-8 items-center justify-center rounded-lg">
        <Layers size={18} strokeWidth={2.25} />
      </span>
      CMS Intranet
    </Link>
  );
}

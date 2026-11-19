import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/logo.png";

/** Pastille claire : le logo est noir sur fond transparent, il doit rester lisible en thème sombre. */
export function LogoMark({ className = "size-10 rounded-lg p-1.5" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-white shadow-sm ring-1 ring-black/5 ${className}`}
    >
      <Image src={logo} alt="" className="h-full w-auto object-contain" />
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="CMS Intranet, accueil"
      className={`flex items-center gap-2.5 font-display text-xl font-bold text-site-ink ${className}`}
    >
      <LogoMark />
      CMS Intranet
    </Link>
  );
}

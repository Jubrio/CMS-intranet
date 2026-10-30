"use client";

import { useEffect, useRef } from "react";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Api = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Api;
  }
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cle = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!cle || !ref.current) return;
    const conteneur = ref.current;
    let widget: string | undefined;

    const afficher = () => {
      if (!window.turnstile || widget !== undefined) return;
      widget = window.turnstile.render(conteneur, {
        sitekey: cle,
        callback: (t) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };

    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    if (window.turnstile) afficher();
    else script.addEventListener("load", afficher);

    return () => {
      script?.removeEventListener("load", afficher);
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [onToken]);

  return <div ref={ref} className="min-h-[65px]" />;
}

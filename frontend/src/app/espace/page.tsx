"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { effacerToken, lireToken } from "@/lib/session";

type Profil = {
  prenom: string;
  nom: string;
  email: string;
  role: string;
  entreprise: string | null;
  modules_actifs: string[];
};

// Page PROVISOIRE : elle prouve que la création / la connexion fonctionnent
// de bout en bout. Elle sera remplacée par l'application intranet connectée.
export default function Espace() {
  const router = useRouter();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const token = lireToken();
    if (!token) {
      router.replace("/connexion");
      return;
    }
    api<Profil>("/me", { token })
      .then(setProfil)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          effacerToken();
          router.replace("/connexion");
        } else {
          setErreur("Impossible de charger votre profil.");
        }
      });
  }, [router]);

  async function deconnecter() {
    const token = lireToken();
    try {
      await api("/logout", { method: "POST", token });
    } catch {
      // le jeton local est supprimé dans tous les cas
    }
    effacerToken();
    router.replace("/");
  }

  if (erreur) return <main className="p-8">{erreur}</main>;
  if (!profil) return <main className="p-8 text-sm text-muted-foreground">Chargement…</main>;

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Bonjour, {profil.prenom}</h1>
      <p className="mt-1 text-muted-foreground">
        {profil.entreprise} · {profil.role}
      </p>
      <p className="mt-6 text-sm">
        Modules actifs : {profil.modules_actifs.length > 0 ? profil.modules_actifs.join(", ") : "aucun"}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">L&apos;espace intranet complet arrive à la prochaine étape.</p>
      <button
        type="button"
        onClick={deconnecter}
        className="mt-8 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
      >
        Se déconnecter
      </button>
    </main>
  );
}

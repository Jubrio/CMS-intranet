"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict, isSameYear } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, Building2, CheckCheck, Globe, Loader2 } from "lucide-react";
import { api, ApiError, urlStockage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";

type Notif = {
  id: number;
  lu: boolean;
  action: string;
  objet_type: string;
  objet_id: number;
  titre: string;
  departement: string | null;
  acteur: { id: number; nom: string; prenom: string; photo: string | null } | null;
  date: string | null;
};

type Page = { data: Notif[]; current_page: number; last_page: number };

const INTERVALLE = 30_000;

const PHRASES: Record<string, string> = {
  "publie:actualite": "a publié l'actualité",
  "publie:annonce": "a publié l'annonce",
  "publie:article": "a publié l'article",
  "publie:note_service": "a publié la note de service",
  "cree:evenement": "a créé l'événement",
  "depose:document": "a déposé le document",
};

const CONTENUS = ["actualite", "annonce", "article", "note_service"];

const phrase = (n: Notif) => PHRASES[`${n.action}:${n.objet_type}`] ?? "a ajouté";
function adresse(n: Notif): string {
  if (CONTENUS.includes(n.objet_type)) return `/espace/accueil?ouvrir=${n.objet_type}-${n.objet_id}`;
  if (n.objet_type === "evenement") return `/espace/calendrier?ouvrir=${n.objet_id}`;
  if (n.objet_type === "document") return "/espace/consulter-documents";
  return "/espace";
}

const ilYA = (iso: string | null) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: fr }) : "";

function dateExacte(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return format(d, isSameYear(d, new Date()) ? "d MMMM, HH:mm" : "d MMMM yyyy, HH:mm", { locale: fr });
}

function Avatar({ acteur }: { acteur: Notif["acteur"] }) {
  if (!acteur) return <span aria-hidden className="size-9 shrink-0 rounded-full bg-site-line" />;
  return acteur.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={urlStockage(acteur.photo)} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-xs font-semibold text-brand-violet"
    >
      {`${acteur.prenom.charAt(0)}${acteur.nom.charAt(0)}`.toUpperCase()}
    </span>
  );
}

export function NotificationsCloche() {
  const { token, expirer } = useEspace();
  const router = useRouter();
  const racine = useRef<HTMLDivElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [nonLues, setNonLues] = useState(0);
  const [liste, setListe] = useState<Notif[]>([]);
  const [pagination, setPagination] = useState({ courante: 1, derniere: 1 });
  const [etat, setEtat] = useState<"chargement" | "ok" | "erreur">("chargement");
  const [plus, setPlus] = useState(false);

  const surErreur = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) expirer();
    },
    [expirer],
  );

  const chargerCompte = useCallback(async () => {
    try {
      const r = await api<{ non_lues: number }>("/notifications/non-lues", { token });
      setNonLues(r.non_lues);
    } catch (err) {
      surErreur(err);
    }
  }, [token, surErreur]);

  const chargerListe = useCallback(async () => {
    try {
      const r = await api<Page>("/notifications", { token });
      setListe(r.data);
      setPagination({ courante: r.current_page, derniere: r.last_page });
      setEtat("ok");
    } catch (err) {
      surErreur(err);
      setEtat("erreur");
    }
  }, [token, surErreur]);

  useEffect(() => {
    const actualiser = () => {
      if (document.visibilityState !== "visible") return;
      void chargerCompte();
      if (ouvert && pagination.courante === 1) void chargerListe();
    };
    actualiser();
    const minuteur = window.setInterval(actualiser, INTERVALLE);
    document.addEventListener("visibilitychange", actualiser);
    return () => {
      window.clearInterval(minuteur);
      document.removeEventListener("visibilitychange", actualiser);
    };
  }, [ouvert, pagination.courante, chargerCompte, chargerListe]);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", surClic);
    window.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      window.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  function ouvrirNotification(n: Notif) {
    setOuvert(false);
    if (!n.lu) {
      setListe((l) => l.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
      setNonLues((c) => Math.max(0, c - 1));
      api(`/notifications/${n.id}/lire`, { method: "POST", token }).catch(surErreur);
    }
    router.push(adresse(n));
  }

  async function toutLire() {
    setListe((l) => l.map((x) => ({ ...x, lu: true })));
    setNonLues(0);
    try {
      await api("/notifications/tout-lire", { method: "POST", token });
    } catch (err) {
      surErreur(err);
      void chargerCompte();
      void chargerListe();
    }
  }

  async function voirPlus() {
    setPlus(true);
    try {
      const r = await api<Page>(`/notifications?page=${pagination.courante + 1}`, { token });
      setListe((l) => [...l, ...r.data.filter((n) => !l.some((x) => x.id === n.id))]);
      setPagination({ courante: r.current_page, derniere: r.last_page });
    } catch (err) {
      surErreur(err);
    } finally {
      setPlus(false);
    }
  }

  return (
    <div ref={racine} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        title="Notifications"
        className="relative inline-flex size-10 items-center justify-center rounded-full border border-site-line text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
      >
        <Bell size={18} aria-hidden />
        {nonLues > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-site-danger px-1 text-[0.65rem] font-bold leading-none text-white"
          >
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
        <span className="sr-only">
          {nonLues > 0 ? `Notifications, ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
        </span>
      </button>

      {ouvert && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-site-line bg-site-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-site-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {nonLues > 0 && (
              <button
                type="button"
                onClick={toutLire}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-violet hover:underline"
              >
                <CheckCheck size={14} aria-hidden />
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {etat === "chargement" && (
              <div className="flex items-center justify-center p-8" role="status" aria-label="Chargement">
                <Loader2 size={20} className="animate-spin text-site-muted" aria-hidden />
              </div>
            )}

            {etat === "erreur" && (
              <div className="space-y-3 p-6 text-center text-sm text-site-muted">
                <p>Impossible de charger les notifications.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEtat("chargement");
                    void chargerListe();
                  }}
                  className="rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink hover:border-brand-violet/60"
                >
                  Réessayer
                </button>
              </div>
            )}

            {etat === "ok" && liste.length === 0 && (
              <p className="p-8 text-center text-sm text-site-muted">Aucune notification pour le moment.</p>
            )}

            {etat === "ok" && liste.length > 0 && (
              <ul className="divide-y divide-site-line">
                {liste.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => ouvrirNotification(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-site-surface2 focus-visible:bg-site-surface2 focus-visible:outline-none",
                        !n.lu && "bg-brand-violet/5",
                      )}
                    >
                      <Avatar acteur={n.acteur} />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block text-sm leading-snug">
                          <span className="font-semibold">
                            {n.acteur ? `${n.acteur.prenom} ${n.acteur.nom}` : "Un utilisateur"}
                          </span>{" "}
                          {phrase(n)} <span className="font-medium">« {n.titre} »</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-site-muted">
                          <time dateTime={n.date ?? undefined} title={dateExacte(n.date)}>
                            {ilYA(n.date)}
                          </time>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            {n.departement ? (
                              <>
                                <Building2 size={12} aria-hidden />
                                {n.departement}
                              </>
                            ) : (
                              <>
                                <Globe size={12} aria-hidden />
                                Toute l&apos;entreprise
                              </>
                            )}
                          </span>
                        </span>
                      </span>
                      {!n.lu && (
                        <>
                          <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-violet" />
                          <span className="sr-only">Non lue</span>
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {etat === "ok" && pagination.courante < pagination.derniere && (
              <div className="border-t border-site-line p-3 text-center">
                <button
                  type="button"
                  onClick={voirPlus}
                  disabled={plus}
                  className="inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
                >
                  {plus && <Loader2 size={12} className="animate-spin" aria-hidden />}
                  Voir plus
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

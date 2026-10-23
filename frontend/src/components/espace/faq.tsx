"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { type LucideIcon, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import { FaqFormulaire, type CategorieFaq, type QuestionFaq } from "./faq-formulaire";

type Pagination<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

const nombre = new Intl.NumberFormat("fr-FR");

function Ico({ de, size }: { de: LucideIcon; size: number }) {
  const Composant = de;
  return <Composant size={size} aria-hidden />;
}

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Stat({ icone, libelle, valeur }: { icone: LucideIcon; libelle: string; valeur: number | null }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-site-line bg-site-surface p-4 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
        <Ico de={icone} size={20} />
      </span>
      <div>
        <p className="text-xs font-medium text-site-muted">{libelle}</p>
        {valeur === null ? <Squelette className="mt-1.5 h-6 w-12" /> : <p className="font-display text-2xl font-bold leading-tight tabular-nums">{nombre.format(valeur)}</p>}
      </div>
    </div>
  );
}

function BoutonIcone({ libelle, onClick, disabled, danger, children }: { libelle: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors disabled:pointer-events-none disabled:opacity-40",
        danger ? "hover:bg-site-danger/10 hover:text-site-danger" : "hover:bg-site-surface2 hover:text-site-ink",
      )}
    >
      {children}
    </button>
  );
}

export function Faq() {
  const { profil, token, expirer } = useEspace();
  const autorise = profil.permissions.includes("faq.gerer");

  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [categorieChoisie, setCategorieChoisie] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [ouvertes, setOuvertes] = useState<Set<number>>(new Set());
  const [formulaire, setFormulaire] = useState<{ question: QuestionFaq | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<QuestionFaq | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  // Recherche : on attend la fin de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Catégories et nombre de questions de chacune
  const chargerCategories = useCallback(
    async (jeton: string) => {
      void version;
      return api<CategorieFaq[]>("/faq/categories", { token: jeton });
    },
    [version],
  );
  const cats = useDonnees(autorise, chargerCategories);
  const categories = useMemo(() => cats.donnees ?? [], [cats.donnees]);
  const nomsCategories = useMemo(() => categories.map((c) => c.categorie), [categories]);
  const totalQuestions = cats.donnees ? cats.donnees.reduce((s, c) => s + c.nb_questions, 0) : null;
  // Une catégorie qui n'existe plus (dernière question supprimée) ne filtre plus
  const categorie = cats.donnees === null || nomsCategories.includes(categorieChoisie) ? categorieChoisie : "";

  // Liste filtrée
  const cleCourante = `${page}|${q}|${categorie}|${version}`;
  const chargerListe = useCallback(
    async (jeton: string) => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set("q", q);
      if (categorie) p.set("categorie", categorie);
      const res = await api<Pagination<QuestionFaq>>(`/faq?${p.toString()}`, { token: jeton });
      // Dernière page vidée (ex. dernière question supprimée) : on recule jusqu'à la dernière page existante
      if (res.data.length === 0 && res.current_page > 1) setPage(Math.max(1, res.last_page));
      return { cle: cleCourante, res };
    },
    [page, q, categorie, cleCourante],
  );
  const liste = useDonnees(autorise, chargerListe);
  const enChargement = liste.chargement || (liste.donnees !== null && liste.donnees.cle !== cleCourante);
  const res = liste.donnees?.res ?? null;

  const fermerFormulaire = useCallback(() => setFormulaire(null), []);

  function basculer(id: number) {
    setOuvertes((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function apresEnregistrement(texte: string) {
    setFormulaire(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  }

  async function supprimer(f: QuestionFaq) {
    setASupprimer(null);
    setEnCoursId(f.id);
    try {
      await api<{ message: string }>(`/faq/${f.id}`, { method: "DELETE", token });
      setNotice({ type: "ok", texte: "La question a été supprimée." });
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCoursId(null);
    }
  }

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Vous n’avez pas accès à la gestion de la FAQ.
      </p>
    );
  }

  const filtre = q !== "" || categorie !== "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">FAQ</h1>
          <p className="mt-1 text-sm text-site-muted">Répondez d’avance aux questions fréquentes de vos équipes.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire({ question: null })}
          className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus size={16} aria-hidden />
          Nouvelle question
        </button>
      </div>

      {notice && (
        <p
          role={notice.type === "erreur" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok" ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan" : "border-site-danger/40 bg-site-danger/10 text-site-danger",
          )}
        >
          {notice.texte}
          <button type="button" aria-label="Masquer le message" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={16} aria-hidden />
          </button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icone={CircleHelp} libelle="Questions" valeur={totalQuestions} />
        <Stat icone={Tags} libelle="Catégories" valeur={cats.donnees ? cats.donnees.length : null} />
      </div>

      <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-site-line p-4">
          <div className="relative min-w-52 max-w-md flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted" />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Rechercher dans les questions et réponses"
              aria-label="Rechercher dans la FAQ"
              className={cn(CHAMP, "pl-9")}
            />
          </div>
          <select
            value={categorie}
            onChange={(e) => {
              setCategorieChoisie(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par catégorie"
            className={cn(CHAMP, "w-auto min-w-44")}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.categorie} value={c.categorie}>
                {c.categorie} ({c.nb_questions})
              </option>
            ))}
          </select>
          {filtre && (
            <button
              type="button"
              onClick={() => {
                setSaisie("");
                setQ("");
                setCategorieChoisie("");
                setPage(1);
              }}
              className="inline-flex h-10 items-center rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {liste.erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Impossible de charger la FAQ. Votre rôle doit aussi pouvoir consulter la FAQ.</span>
            <button
              type="button"
              onClick={liste.reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : enChargement ? (
          <ul className="divide-y divide-site-line" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Squelette className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-3.5 w-72" />
                  <Squelette className="h-3 w-32" />
                </div>
              </li>
            ))}
          </ul>
        ) : !res || res.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
              <CircleHelp size={22} aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">{filtre ? "Aucune question ne correspond à cette recherche." : "Aucune question pour le moment."}</p>
            {!filtre && <p className="mt-1 text-xs text-site-muted">Ajoutez une première question pour alimenter la FAQ.</p>}
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-site-line">
              {res.data.map((f) => {
                const ouverte = ouvertes.has(f.id);
                const occupe = enCoursId === f.id;
                return (
                  <li key={f.id} className="px-5 py-3 transition-colors hover:bg-site-surface2/50">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => basculer(f.id)}
                        aria-expanded={ouverte}
                        aria-controls={`reponse-${f.id}`}
                        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40"
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-violet/15 text-brand-violet">
                          <ChevronDown size={16} aria-hidden className={cn("transition-transform", ouverte && "rotate-180")} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-semibold", !ouverte && "truncate")}>{f.question}</span>
                          <span className="mt-1 inline-flex max-w-full rounded-full bg-brand-blue/15 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                            <span className="truncate">{f.categorie}</span>
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <BoutonIcone libelle={`Modifier la question « ${f.question} »`} disabled={occupe} onClick={() => setFormulaire({ question: f })}>
                          <Pencil size={16} aria-hidden />
                        </BoutonIcone>
                        <BoutonIcone libelle={`Supprimer la question « ${f.question} »`} danger disabled={occupe} onClick={() => setASupprimer(f)}>
                          <Trash2 size={16} aria-hidden />
                        </BoutonIcone>
                      </div>
                    </div>

                    {ouverte && (
                      <div id={`reponse-${f.id}`} className="ml-11 mt-2 rounded-xl border border-site-line bg-site-base/40 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{f.reponse}</p>
                        {f.auteur && (
                          <p className="mt-2 text-xs text-site-muted">
                            Ajoutée par {f.auteur.prenom} {f.auteur.nom}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {res.last_page > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-site-line px-5 py-3">
                <p className="text-xs text-site-muted">
                  Page {res.current_page} sur {res.last_page} · {nombre.format(res.total)} question{res.total > 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    disabled={res.current_page <= 1}
                    aria-label="Page précédente"
                    className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.min(res.last_page, n + 1))}
                    disabled={res.current_page >= res.last_page}
                    aria-label="Page suivante"
                    className="flex size-8 items-center justify-center rounded-lg border border-site-line text-site-muted transition-colors hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}
      </section>

      {formulaire && (
        <FaqFormulaire
          key={formulaire.question?.id ?? "nouvelle"}
          question={formulaire.question}
          categories={nomsCategories}
          categorieParDefaut={categorie}
          onFermer={fermerFormulaire}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aSupprimer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titre-suppression-faq">
          <button type="button" aria-label="Annuler" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setASupprimer(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-site-line bg-site-surface p-6 shadow-2xl">
            <h2 id="titre-suppression-faq" className="font-display text-base font-semibold">
              Supprimer cette question ?
            </h2>
            <p className="mt-2 text-sm text-site-muted">La question « {aSupprimer.question} » et sa réponse seront supprimées définitivement. Cette action est irréversible.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setASupprimer(null)}
                className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => supprimer(aSupprimer)}
                className="h-10 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

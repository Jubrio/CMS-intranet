"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Megaphone,
  MessageSquarePlus,
  SendHorizontal,
  Sparkles,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { ApiError, messageErreur } from "@/lib/api";
import { annulerAction, confirmerAction, envoyerMessage, type ActionPropose } from "@/lib/assistant";
import { estSuperAdmin } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";

const PERMISSIONS_PUBLICATION = ["actualites.publier", "annonces.publier", "articles.publier"];
const DUREE_MOT_DE_PASSE = 10 * 60 * 1000;

const OUTILS: Record<string, { libelle: string; Icone: LucideIcon }> = {
  creer_utilisateur: { libelle: "Créer un compte", Icone: UserPlus },
  publier_contenu: { libelle: "Publier un contenu", Icone: Megaphone },
};

type EtatCarte = "attente" | "envoi" | "fait" | "annule" | "echec";

/** `motDePasse` : undefined = sans objet, texte = à noter maintenant, null = déjà effacé de l'écran. */
type Carte = ActionPropose & { etat: EtatCarte; message?: string; motDePasse?: string | null };

type Contenu =
  | { type: "moi"; texte: string }
  | { type: "assistant"; texte: string }
  | { type: "erreur"; texte: string }
  | { type: "cartes"; cartes: Carte[] };

type Element = Contenu & { id: number };

/** Affiche le panneau seulement à ceux qui ont au moins un outil : le serveur reste l'arbitre. */
export function AssistantPanneau() {
  const { profil } = useEspace();
  const autorise =
    !estSuperAdmin(profil) &&
    profil.permissions.some((p) => p === "utilisateurs.gerer" || PERMISSIONS_PUBLICATION.includes(p));

  if (!autorise) return null;
  return <Assistant />;
}

function Assistant() {
  const { profil, token, expirer } = useEspace();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [elements, setElements] = useState<Element[]>([]);
  const [attente, setAttente] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const compteur = useRef(0);
  const corps = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  const peutGererUtilisateurs = profil.permissions.includes("utilisateurs.gerer");
  const peutPublier = profil.permissions.some((p) => PERMISSIONS_PUBLICATION.includes(p));
  const motDePasseAffiche = elements.some(
    (e) => e.type === "cartes" && e.cartes.some((c) => typeof c.motDePasse === "string"),
  );

  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  useEffect(() => {
    if (corps.current) corps.current.scrollTop = corps.current.scrollHeight;
  }, [elements, attente, ouvert]);

  const ajouter = useCallback((contenu: Contenu) => {
    setElements((liste) => [...liste, { ...contenu, id: ++compteur.current }]);
  }, []);

  const majCarte = useCallback((id: number, patch: Partial<Carte>) => {
    setElements((liste) =>
      liste.map((e) =>
        e.type === "cartes" ? { ...e, cartes: e.cartes.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : e,
      ),
    );
  }, []);

  const texteErreur = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          expirer();
          return "Votre session a expiré.";
        }
        // 403 (rôle sans outil) et 503 (assistant local éteint) : le serveur donne déjà un message clair
        if (err.status === 403 || err.status === 503) return err.message;
      }
      return messageErreur(err);
    },
    [expirer],
  );

  async function envoyer(texte: string) {
    const message = texte.trim();
    if (!message || attente) return;
    ajouter({ type: "moi", texte: message });
    setSaisie("");
    setAttente(true);
    try {
      const r = await envoyerMessage(token, message, conversationId);
      setConversationId(r.conversation_id);
      if (r.actions.length > 0) {
        ajouter({ type: "cartes", cartes: r.actions.map((a) => ({ ...a, etat: "attente" as const })) });
      } else {
        ajouter({ type: "assistant", texte: r.reponse });
      }
    } catch (err) {
      ajouter({ type: "erreur", texte: texteErreur(err) });
    } finally {
      setAttente(false);
      champ.current?.focus();
    }
  }

  async function decider(carte: Carte, confirmer: boolean) {
    majCarte(carte.id, { etat: "envoi", message: undefined });
    try {
      if (confirmer) {
        const r = await confirmerAction(token, carte.id);
        majCarte(carte.id, { etat: "fait", message: r.message, motDePasse: r.secret?.mot_de_passe_temporaire });
      } else {
        await annulerAction(token, carte.id);
        majCarte(carte.id, { etat: "annule" });
      }
    } catch (err) {
      // Si le serveur a répondu (action refusée, déjà traitée), elle est réglée. Sinon (réseau, 5xx, 429),
      // on laisse réessayer : une action déjà exécutée répondrait « déjà traitée », sans doublon.
      const reglee = err instanceof ApiError && err.status < 500 && err.status !== 429;
      majCarte(carte.id, { etat: reglee ? "echec" : "attente", message: texteErreur(err) });
    }
  }

  function nouvelleConversation() {
    setElements([]);
    setConversationId(null);
    setSaisie("");
    champ.current?.focus();
  }

  function suggerer(modele: string) {
    setSaisie(modele);
    champ.current?.focus();
  }

  function surTouche(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void envoyer(saisie);
    }
  }

  function surEnvoi(e: FormEvent) {
    e.preventDefault();
    void envoyer(saisie);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        title="Assistant"
        className="fixed bottom-5 right-5 z-40 inline-flex size-12 items-center justify-center rounded-full bg-brand-violet text-white shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/50 focus-visible:ring-offset-2 focus-visible:ring-offset-site-base"
      >
        {ouvert ? <X size={20} aria-hidden /> : <Sparkles size={20} aria-hidden />}
        <span className="sr-only">{ouvert ? "Fermer l'assistant" : "Ouvrir l'assistant"}</span>
      </button>

      {ouvert && (
        <section
          role="dialog"
          aria-label="Assistant"
          className="fixed inset-x-3 bottom-20 top-20 z-[60] flex flex-col overflow-hidden rounded-2xl border border-site-line bg-site-surface shadow-2xl sm:inset-x-auto sm:right-5 sm:top-auto sm:h-[36rem] sm:max-h-[calc(100vh-7rem)] sm:w-[26rem]"
        >
          <header className="flex items-center gap-3 border-b border-site-line px-4 py-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet"
            >
              <Sparkles size={18} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Assistant</p>
              <p className="truncate text-xs text-site-muted">Je prépare l&apos;action, vous confirmez.</p>
            </div>
            {elements.length > 0 && (
              <button
                type="button"
                onClick={nouvelleConversation}
                disabled={motDePasseAffiche}
                title={motDePasseAffiche ? "Notez d'abord le mot de passe temporaire affiché" : "Nouvelle conversation"}
                className="inline-flex size-8 items-center justify-center rounded-full text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <MessageSquarePlus size={16} aria-hidden />
                <span className="sr-only">Nouvelle conversation</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="inline-flex size-8 items-center justify-center rounded-full text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
            >
              <X size={16} aria-hidden />
              <span className="sr-only">Fermer</span>
            </button>
          </header>

          <div
            ref={corps}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {elements.length === 0 && !attente && (
              <div className="space-y-3 text-sm text-site-muted">
                <p>
                  Demandez-moi une tâche en une phrase. Je la prépare, vous vérifiez le détail, puis vous confirmez :
                  rien n&apos;est fait sans votre accord.
                </p>
                <div className="flex flex-wrap gap-2">
                  {peutGererUtilisateurs && (
                    <button
                      type="button"
                      onClick={() => suggerer("Crée un compte pour ")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1.5 text-xs font-medium text-site-ink transition-colors hover:border-brand-violet/60"
                    >
                      <UserPlus size={14} aria-hidden />
                      Créer un utilisateur
                    </button>
                  )}
                  {peutPublier && (
                    <button
                      type="button"
                      onClick={() => suggerer("Publie une actualité : ")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1.5 text-xs font-medium text-site-ink transition-colors hover:border-brand-violet/60"
                    >
                      <Megaphone size={14} aria-hidden />
                      Publier une actualité
                    </button>
                  )}
                </div>
              </div>
            )}

            {elements.map((e) => {
              if (e.type === "moi") {
                return (
                  <p
                    key={e.id}
                    className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-violet px-3 py-2 text-sm text-white"
                  >
                    {e.texte}
                  </p>
                );
              }
              if (e.type === "assistant") {
                return (
                  <p
                    key={e.id}
                    className="mr-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-site-surface2 px-3 py-2 text-sm"
                  >
                    {e.texte}
                  </p>
                );
              }
              if (e.type === "erreur") {
                return (
                  <p
                    key={e.id}
                    role="alert"
                    className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger"
                  >
                    {e.texte}
                  </p>
                );
              }
              return (
                <div key={e.id} className="space-y-2">
                  <p className="text-xs text-site-muted">Vérifiez avant de confirmer :</p>
                  {e.cartes.map((c) => (
                    <CarteAction
                      key={c.id}
                      carte={c}
                      onDecider={(confirmer) => void decider(c, confirmer)}
                      onEffacerMotDePasse={() => majCarte(c.id, { motDePasse: null })}
                    />
                  ))}
                </div>
              );
            })}

            {attente && (
              <p
                role="status"
                className="mr-auto flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-site-surface2 px-3 py-2 text-sm text-site-muted"
              >
                <Loader2 size={14} className="animate-spin" aria-hidden />
                L&apos;assistant réfléchit…
              </p>
            )}
          </div>

          <form onSubmit={surEnvoi} className="flex items-end gap-2 border-t border-site-line p-3">
            <label htmlFor="assistant-saisie" className="sr-only">
              Votre message à l&apos;assistant
            </label>
            <textarea
              id="assistant-saisie"
              ref={champ}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={surTouche}
              maxLength={2000}
              rows={2}
              placeholder="Ex. : Crée un compte pour Jean Rakoto, RH…"
              className="min-h-10 flex-1 resize-none rounded-xl border border-site-line bg-site-base px-3 py-2 text-sm outline-none placeholder:text-site-muted focus-visible:border-brand-violet/60 focus-visible:ring-2 focus-visible:ring-brand-violet/30"
            />
            <button
              type="submit"
              disabled={attente || saisie.trim() === ""}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-violet text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              <SendHorizontal size={16} aria-hidden />
              <span className="sr-only">Envoyer</span>
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function CarteAction({
  carte,
  onDecider,
  onEffacerMotDePasse,
}: {
  carte: Carte;
  onDecider: (confirmer: boolean) => void;
  onEffacerMotDePasse: () => void;
}) {
  const { libelle, Icone } = OUTILS[carte.outil] ?? { libelle: "Action", Icone: Sparkles };
  // Le résumé donne la phrase d'action, puis (pour une publication) le texte complet à relire
  const [titre, ...reste] = carte.resume.split("\n\n");
  const texte = reste.join("\n\n");
  const enAttente = carte.etat === "attente" || carte.etat === "envoi";
  const occupe = carte.etat === "envoi";

  return (
    <div className="rounded-xl border border-site-line bg-site-base p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-violet">
          <Icone size={14} aria-hidden />
          {libelle}
        </p>
        {carte.etat === "fait" && <span className="text-xs font-medium text-brand-cyan">Effectué</span>}
        {carte.etat === "annule" && <span className="text-xs font-medium text-site-muted">Annulé</span>}
        {carte.etat === "echec" && <span className="text-xs font-medium text-site-danger">Non effectué</span>}
      </div>

      <p className="mt-2 text-sm font-medium leading-snug">{titre}</p>
      {texte && (
        <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-site-line bg-site-surface2 p-2.5 text-sm">
          {texte}
        </div>
      )}

      {carte.message && (carte.etat === "attente" || carte.etat === "echec") && (
        <p role="alert" className="mt-2 text-xs text-site-danger">
          {carte.message}
        </p>
      )}

      {enAttente && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={occupe}
            onClick={() => onDecider(false)}
            className="h-9 rounded-full border border-site-line px-4 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:pointer-events-none disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={occupe}
            onClick={() => onDecider(true)}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-violet px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
          >
            {occupe ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
            Confirmer
          </button>
        </div>
      )}

      {carte.etat === "fait" && (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-sm text-brand-cyan">
          <Check size={16} aria-hidden className="mt-0.5 shrink-0" />
          {carte.message}
        </p>
      )}

      {typeof carte.motDePasse === "string" && (
        <MotDePasseTemporaire valeur={carte.motDePasse} onEffacer={onEffacerMotDePasse} />
      )}
      {carte.motDePasse === null && (
        <p className="mt-2 text-xs text-site-muted">Le mot de passe temporaire n&apos;est plus affiché.</p>
      )}
    </div>
  );
}

/** Mot de passe généré par le serveur : visible une seule fois, uniquement en mémoire de cette page. */
function MotDePasseTemporaire({ valeur, onEffacer }: { valeur: string; onEffacer: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copie, setCopie] = useState(false);
  const effacer = useRef(onEffacer);

  useEffect(() => {
    effacer.current = onEffacer;
  });

  // Effacé automatiquement au bout de quelques minutes, même s'il n'a pas été noté
  useEffect(() => {
    const minuteur = window.setTimeout(() => effacer.current(), DUREE_MOT_DE_PASSE);
    return () => window.clearTimeout(minuteur);
  }, []);

  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // presse-papiers indisponible : on l'affiche pour qu'il soit recopié à la main
      setVisible(true);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-violet/40 bg-brand-violet/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-violet">
        <KeyRound size={14} aria-hidden />
        Mot de passe temporaire
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code
          className={cn(
            "min-w-0 flex-1 break-all rounded-md border border-site-line bg-site-surface px-2.5 py-1.5 font-mono text-sm",
            visible && "select-all",
          )}
        >
          {visible ? valeur : "•".repeat(valeur.length)}
        </code>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          title={visible ? "Masquer" : "Afficher"}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-site-line text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink"
        >
          {visible ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          <span className="sr-only">{visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}</span>
        </button>
        <button
          type="button"
          onClick={() => void copier()}
          title="Copier"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-site-line text-site-muted transition-colors hover:border-brand-violet/60 hover:text-site-ink"
        >
          {copie ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          <span className="sr-only">{copie ? "Copié" : "Copier le mot de passe"}</span>
        </button>
      </div>
      <p className="mt-2 text-xs text-site-muted">
        Notez-le maintenant : il ne sera plus jamais affiché. Transmettez-le à la personne par un moyen sûr.
      </p>
      <button
        type="button"
        onClick={onEffacer}
        className="mt-2 h-8 rounded-full border border-site-line px-3 text-xs font-semibold transition-colors hover:border-brand-violet/60"
      >
        J&apos;ai noté le mot de passe
      </button>
    </div>
  );
}

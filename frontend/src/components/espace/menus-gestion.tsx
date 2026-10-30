"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, Link2, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";

type ModuleMenu = {
  code: string;
  libelle_defaut: string;
  libelle: string;
  ordre: number;
  visible: boolean;
  roles: number[] | null;
  personnalise: boolean;
};
type LienMenu = {
  id: number;
  libelle_menu: string;
  url_menu: string;
  ordre_menu: number;
  visible: boolean;
  roles: number[] | null;
};
type VueMenus = { modules: ModuleMenu[]; liens: LienMenu[] };
type RoleOption = { id: number; nom_role: string };
type Edition = { type: "module"; module: ModuleMenu } | { type: "lien"; lien: LienMenu | null };

const MAX_LIENS = 30;
const REGEX_URL = /^(https:\/\/[^\s\\]+|\/(?![/\\])[^\s\\]*)$/;

function Squelette({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-site-line", className)} />;
}

function Interrupteur({
  actif,
  onChange,
  libelle,
  disabled,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  libelle: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={disabled}
      onClick={() => onChange(!actif)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        actif ? "bg-brand-violet" : "bg-site-line",
      )}
    >
      <span
        className={cn(
          "size-5 rounded-full bg-white shadow transition-transform",
          actif ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function BoutonIcone({
  libelle,
  onClick,
  disabled,
  danger,
  children,
}: {
  libelle: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
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

function Modale({
  titre,
  onFermer,
  bloque,
  children,
}: {
  titre: string;
  onFermer: () => void;
  bloque?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && !bloque && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer, bloque]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={titre}
    >
      <button
        type="button"
        aria-label="Fermer"
        disabled={bloque}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-site-line bg-site-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-site-line px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-semibold">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            disabled={bloque}
            aria-label="Fermer"
            className="flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink disabled:opacity-40"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ---- Formulaire d'une entrée  ---------------------------------------

function FormulaireEntree({
  edition,
  roles,
  rolesIndisponibles,
  onFermer,
  onEnregistre,
}: {
  edition: Edition;
  roles: RoleOption[];
  rolesIndisponibles: boolean;
  onFermer: () => void;
  onEnregistre: (texte: string) => void;
}) {
  const { profil, token, expirer } = useEspace();
  const estModule = edition.type === "module";
  const lien = edition.type === "lien" ? edition.lien : null;
  const entreeModule = edition.type === "module" ? edition.module : null;

  const [libelle, setLibelle] = useState(
    entreeModule ? (entreeModule.personnalise ? entreeModule.libelle : "") : (lien?.libelle_menu ?? ""),
  );
  const [url, setUrl] = useState(lien?.url_menu ?? "");
  const [ordre, setOrdre] = useState(String(entreeModule ? entreeModule.ordre : (lien?.ordre_menu ?? "")));
  const [visible, setVisible] = useState(entreeModule ? entreeModule.visible : (lien?.visible ?? true));
  const initiaux = entreeModule ? entreeModule.roles : (lien?.roles ?? null);
  const [restreint, setRestreint] = useState(initiaux !== null);
  const [choisis, setChoisis] = useState<number[]>(initiaux ?? []);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const monRole = roles.find((r) => r.nom_role === profil.role);
  const meMasque = visible === false || (restreint && monRole !== undefined && !choisis.includes(monRole.id));

  const basculerRole = (id: number) => setChoisis((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreurGlobale(null);

    const locales: Record<string, string> = {};
    const nom = libelle.trim();
    if (!estModule && nom === "") locales.libelle_menu = "Le libellé est obligatoire.";
    if (nom.length > 50) locales.libelle_menu = "50 caractères maximum.";
    if (!estModule && !REGEX_URL.test(url.trim()))
      locales.url_menu = "Saisissez une adresse https://… ou un chemin interne commençant par /.";
    if (ordre.trim() !== "" && !(Number.isInteger(Number(ordre)) && Number(ordre) >= 0 && Number(ordre) <= 9999))
      locales.ordre_menu = "Un nombre entier entre 0 et 9999.";
    if (restreint && choisis.length === 0) locales.roles = "Cochez au moins un rôle, ou choisissez « Tous les rôles ».";
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      return;
    }

    const corps: Record<string, unknown> = {
      libelle_menu: estModule ? (nom === "" || nom === entreeModule?.libelle_defaut ? null : nom) : nom,
      ordre_menu: ordre.trim() === "" ? null : Number(ordre),
      visible,
      roles: restreint ? choisis : null,
    };
    if (!estModule) corps.url_menu = url.trim();

    setEnvoi(true);
    try {
      if (entreeModule) {
        await api(`/menus/modules/${entreeModule.code}`, { method: "PUT", token, body: JSON.stringify(corps) });
        onEnregistre(`L’entrée « ${entreeModule.libelle_defaut} » a été mise à jour.`);
      } else if (lien) {
        await api(`/menus/liens/${lien.id}`, { method: "PUT", token, body: JSON.stringify(corps) });
        onEnregistre(`Le lien « ${nom} » a été mis à jour.`);
      } else {
        await api("/menus/liens", { method: "POST", token, body: JSON.stringify(corps) });
        onEnregistre(`Le lien « ${nom} » a été ajouté.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      if (err instanceof ApiError && err.errors) {
        const serveur: Record<string, string> = {};
        for (const [cle, messages] of Object.entries(err.errors)) serveur[cle.replace(/\..*$/, "")] = messages[0];
        setErreurs(serveur);
      }
      setErreurGlobale(messageErreur(err));
      setEnvoi(false);
    }
  }

  const titre = entreeModule
    ? `Modifier « ${entreeModule.libelle_defaut} »`
    : lien
      ? "Modifier le lien"
      : "Nouveau lien";

  return (
    <Modale titre={titre} onFermer={onFermer} bloque={envoi}>
      <form onSubmit={envoyer} noValidate>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div>
            <label htmlFor="menu-libelle" className="mb-1.5 block text-sm font-medium">
              Libellé dans le menu{!estModule && <span className="ml-1 text-site-danger">*</span>}
            </label>
            <input
              id="menu-libelle"
              type="text"
              maxLength={50}
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder={entreeModule ? entreeModule.libelle_defaut : "Ex. : Portail RH"}
              autoFocus
              className={cn(CHAMP, erreurs.libelle_menu && "border-site-danger")}
            />
            {entreeModule && <p className="mt-1 text-xs text-site-muted">Laissez vide pour garder le nom d’origine.</p>}
            {erreurs.libelle_menu && (
              <p role="alert" className="mt-1.5 text-xs text-site-danger">
                {erreurs.libelle_menu}
              </p>
            )}
          </div>

          {!estModule && (
            <div>
              <label htmlFor="menu-url" className="mb-1.5 block text-sm font-medium">
                Adresse<span className="ml-1 text-site-danger">*</span>
              </label>
              <input
                id="menu-url"
                type="text"
                inputMode="url"
                maxLength={500}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.mg ou /espace/faq"
                className={cn(CHAMP, erreurs.url_menu && "border-site-danger")}
              />
              {erreurs.url_menu && (
                <p role="alert" className="mt-1.5 text-xs text-site-danger">
                  {erreurs.url_menu}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="menu-ordre" className="mb-1.5 block text-sm font-medium">
              Ordre d’affichage
            </label>
            <input
              id="menu-ordre"
              type="number"
              min={0}
              max={9999}
              step={1}
              value={ordre}
              onChange={(e) => setOrdre(e.target.value)}
              className={cn(CHAMP, "max-w-40", erreurs.ordre_menu && "border-site-danger")}
            />
            <p className="mt-1 text-xs text-site-muted">Les plus petits nombres s’affichent en premier.</p>
            {erreurs.ordre_menu && (
              <p role="alert" className="mt-1.5 text-xs text-site-danger">
                {erreurs.ordre_menu}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-site-line px-4 py-3">
            <div>
              <p className="text-sm font-medium">Visible dans le menu</p>
              <p className="text-xs text-site-muted">Masquer l’entrée ne retire aucun droit d’accès.</p>
            </div>
            <Interrupteur actif={visible} onChange={setVisible} libelle="Visible dans le menu" />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Rôles qui voient cette entrée</legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-site-line px-4 py-2.5 text-sm">
                <input
                  type="radio"
                  name="portee"
                  checked={!restreint}
                  onChange={() => setRestreint(false)}
                  className="size-4 accent-brand-violet"
                />
                Tous les rôles
              </label>
              <label
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-site-line px-4 py-2.5 text-sm",
                  rolesIndisponibles ? "opacity-50" : "cursor-pointer",
                )}
              >
                <input
                  type="radio"
                  name="portee"
                  checked={restreint}
                  disabled={rolesIndisponibles}
                  onChange={() => setRestreint(true)}
                  className="size-4 accent-brand-violet"
                />
                Certains rôles seulement
              </label>
            </div>
            {rolesIndisponibles && (
              <p className="mt-1.5 text-xs text-site-muted">
                La liste des rôles n’est pas disponible : votre rôle n’a pas le droit de la consulter.
              </p>
            )}
            {restreint && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-site-line bg-site-base/40 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={choisis.includes(r.id)}
                      onChange={() => basculerRole(r.id)}
                      className="size-4 shrink-0 accent-brand-violet"
                    />
                    <span className="truncate">{r.nom_role}</span>
                  </label>
                ))}
              </div>
            )}
            {erreurs.roles && (
              <p role="alert" className="mt-1.5 text-xs text-site-danger">
                {erreurs.roles}
              </p>
            )}
            {meMasque && (
              <p className="mt-3 rounded-xl border border-site-line bg-site-surface2/50 px-3 py-2 text-xs text-site-muted">
                Avec ce réglage, vous ne verrez plus cette entrée dans votre propre menu.
              </p>
            )}
          </fieldset>

          {erreurGlobale && (
            <p
              role="alert"
              className="rounded-xl border border-site-danger/40 bg-site-danger/10 px-4 py-3 text-sm text-site-danger"
            >
              {erreurGlobale}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-site-line px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onFermer}
            disabled={envoi}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-medium transition-colors hover:border-brand-violet/60 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={envoi}
            className={cn(
              "v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold",
              envoi && "opacity-70",
            )}
          >
            {envoi && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </form>
    </Modale>
  );
}

// ---- Écran --------------------------------------------------------------------------

export function MenusGestion() {
  const { profil, token, expirer, actualiser } = useEspace();
  const autorise = profil.permissions.includes("personnalisation.parametres");

  const [version, setVersion] = useState(0);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [aSupprimer, setASupprimer] = useState<LienMenu | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const charger = useCallback(
    (jeton: string) => {
      void version;
      return api<VueMenus>("/menus", { token: jeton });
    },
    [version],
  );
  const menus = useDonnees(autorise, charger);

  const chargerRoles = useCallback((jeton: string) => api<RoleOption[]>("/roles", { token: jeton }), []);
  const rolesApi = useDonnees(autorise, chargerRoles);
  const roles = rolesApi.donnees ?? [];
  const rolesIndisponibles = rolesApi.erreur;

  const resume = (r: number[] | null) => {
    if (r === null) return "Tous les rôles";
    const noms = r.map((id) => roles.find((x) => x.id === id)?.nom_role).filter(Boolean);
    return noms.length > 0 ? noms.join(", ") : `${r.length} rôle${r.length > 1 ? "s" : ""}`;
  };

  const fermer = useCallback(() => setEdition(null), []);
  const apresEnregistrement = (texte: string) => {
    void actualiser();
    setEdition(null);
    setNotice({ type: "ok", texte });
    setVersion((v) => v + 1);
  };

  async function agir(cle: string, requete: () => Promise<unknown>, succes: string) {
    setEnCours(cle);
    setNotice(null);
    try {
      await requete();
      await actualiser();
      setNotice({ type: "ok", texte: succes });
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      setNotice({ type: "erreur", texte: messageErreur(err) });
    } finally {
      setEnCours(null);
    }
  }

  const basculerModule = (m: ModuleMenu, v: boolean) =>
    agir(
      `m-${m.code}`,
      () => api(`/menus/modules/${m.code}`, { method: "PUT", token, body: JSON.stringify({ visible: v }) }),
      `L’entrée « ${m.libelle} » est ${v ? "visible" : "masquée"}.`,
    );
  const reinitialiser = (m: ModuleMenu) =>
    agir(
      `m-${m.code}`,
      () => api(`/menus/modules/${m.code}`, { method: "DELETE", token }),
      `L’entrée « ${m.libelle_defaut} » est revenue à son réglage d’origine.`,
    );
  const basculerLien = (l: LienMenu, v: boolean) =>
    agir(
      `l-${l.id}`,
      () => api(`/menus/liens/${l.id}`, { method: "PUT", token, body: JSON.stringify({ visible: v }) }),
      `Le lien « ${l.libelle_menu} » est ${v ? "visible" : "masqué"}.`,
    );
  function supprimer(l: LienMenu) {
    setASupprimer(null);
    void agir(
      `l-${l.id}`,
      () => api(`/menus/liens/${l.id}`, { method: "DELETE", token }),
      `Le lien « ${l.libelle_menu} » a été supprimé.`,
    );
  }

  if (!autorise) {
    return (
      <p className="rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
        Vous n’avez pas accès à la configuration des menus.
      </p>
    );
  }

  const vue = menus.donnees;
  const nbLiens = vue?.liens.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Menus</h1>
        <p className="mt-1 text-sm text-site-muted">
          Choisissez ce qui apparaît dans le menu de votre intranet, dans quel ordre et pour quels rôles.
        </p>
      </header>

      {notice && (
        <p
          role={notice.type === "erreur" ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok"
              ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
              : "border-site-danger/40 bg-site-danger/10 text-site-danger",
          )}
        >
          {notice.texte}
        </p>
      )}

      {menus.erreur ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-site-line bg-site-surface p-6 text-sm text-site-muted">
          <span>Impossible de charger la configuration des menus.</span>
          <button
            type="button"
            onClick={menus.reessayer}
            className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
            <div className="border-b border-site-line px-5 py-4">
              <h2 className="font-display text-base font-semibold">Modules</h2>
              <p className="mt-0.5 text-xs text-site-muted">
                Seuls les modules activés dans « Modules » apparaissent ici. Les pages internes se rangent par rubrique,
                depuis leur propre écran.
              </p>
            </div>
            {!vue ? (
              <ul className="divide-y divide-site-line" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-4">
                    <Squelette className="h-4 w-48" />
                  </li>
                ))}
              </ul>
            ) : vue.modules.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-site-muted">Aucun module actif.</p>
            ) : (
              <ul className="divide-y divide-site-line">
                {vue.modules.map((m) => {
                  const occupe = enCours === `m-${m.code}`;
                  return (
                    <li
                      key={m.code}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5",
                        !m.visible && "opacity-70",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{m.libelle}</span>
                          {m.libelle !== m.libelle_defaut && (
                            <span className="text-xs font-normal text-site-muted">(« {m.libelle_defaut} »)</span>
                          )}
                          {m.personnalise && (
                            <span className="rounded-full bg-brand-violet/15 px-2 py-0.5 text-[10px] font-semibold text-brand-violet">
                              Personnalisé
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-site-muted">
                          Ordre {m.ordre} · {resume(m.roles)}
                        </p>
                      </div>
                      <Interrupteur
                        actif={m.visible}
                        onChange={(v) => basculerModule(m, v)}
                        libelle={`Afficher « ${m.libelle} » dans le menu`}
                        disabled={occupe}
                      />
                      <div className="flex items-center">
                        <BoutonIcone
                          libelle={`Modifier « ${m.libelle} »`}
                          onClick={() => setEdition({ type: "module", module: m })}
                          disabled={occupe}
                        >
                          <Pencil size={15} aria-hidden />
                        </BoutonIcone>
                        <BoutonIcone
                          libelle={`Réinitialiser « ${m.libelle_defaut} »`}
                          onClick={() => reinitialiser(m)}
                          disabled={occupe || !m.personnalise}
                        >
                          {occupe ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden />
                          ) : (
                            <RotateCcw size={15} aria-hidden />
                          )}
                        </BoutonIcone>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-site-line bg-site-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-site-line px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold">Liens personnalisés</h2>
                <p className="mt-0.5 text-xs text-site-muted">
                  Ajoutez un raccourci vers un site ou un écran de l’intranet{vue ? ` · ${nbLiens}/${MAX_LIENS}` : ""}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEdition({ type: "lien", lien: null })}
                disabled={!vue || nbLiens >= MAX_LIENS}
                className="v-gradient-btn inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
              >
                <Plus size={15} aria-hidden />
                Ajouter un lien
              </button>
            </div>
            {!vue ? (
              <div className="px-5 py-4" aria-hidden>
                <Squelette className="h-4 w-64" />
              </div>
            ) : vue.liens.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
                  <Link2 size={22} aria-hidden />
                </span>
                <p className="mt-4 text-sm font-medium">Aucun lien personnalisé.</p>
              </div>
            ) : (
              <ul className="divide-y divide-site-line">
                {vue.liens.map((l) => {
                  const occupe = enCours === `l-${l.id}`;
                  return (
                    <li
                      key={l.id}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5",
                        !l.visible && "opacity-70",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{l.libelle_menu}</span>
                          {l.url_menu.startsWith("https://") && (
                            <ExternalLink size={13} aria-hidden className="shrink-0 text-site-muted" />
                          )}
                        </p>
                        <p className="truncate text-xs text-site-muted">
                          {l.url_menu} · Ordre {l.ordre_menu} · {resume(l.roles)}
                        </p>
                      </div>
                      <Interrupteur
                        actif={l.visible}
                        onChange={(v) => basculerLien(l, v)}
                        libelle={`Afficher « ${l.libelle_menu} » dans le menu`}
                        disabled={occupe}
                      />
                      <div className="flex items-center">
                        <BoutonIcone
                          libelle={`Modifier « ${l.libelle_menu} »`}
                          onClick={() => setEdition({ type: "lien", lien: l })}
                          disabled={occupe}
                        >
                          <Pencil size={15} aria-hidden />
                        </BoutonIcone>
                        <BoutonIcone
                          libelle={`Supprimer « ${l.libelle_menu} »`}
                          onClick={() => setASupprimer(l)}
                          disabled={occupe}
                          danger
                        >
                          {occupe ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden />
                          ) : (
                            <Trash2 size={15} aria-hidden />
                          )}
                        </BoutonIcone>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {edition && (
        <FormulaireEntree
          edition={edition}
          roles={roles}
          rolesIndisponibles={rolesIndisponibles}
          onFermer={fermer}
          onEnregistre={apresEnregistrement}
        />
      )}

      {aSupprimer && (
        <Modale titre="Supprimer ce lien ?" onFermer={() => setASupprimer(null)}>
          <div className="px-5 py-5 text-sm sm:px-6">
            Le lien « {aSupprimer.libelle_menu} » disparaîtra du menu de tous les utilisateurs. Cette action est
            définitive.
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-site-line px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setASupprimer(null)}
              className="h-10 rounded-full border border-site-line px-5 text-sm font-medium transition-colors hover:border-brand-violet/60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => supprimer(aSupprimer)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-site-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Trash2 size={15} aria-hidden />
              Supprimer
            </button>
          </footer>
        </Modale>
      )}
    </div>
  );
}

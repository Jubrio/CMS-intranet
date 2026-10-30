"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";

export type Role = {
  id: number;
  nom_role: string;
  role_par_defaut: boolean;
  nb_permissions: number;
  nb_utilisateurs: number;
};

export type PermissionCatalogue = {
  code_permission: string;
  libelle_permission: string;
  code_module: string;
};

type RoleDetail = { id: number; nom_role: string; role_par_defaut: boolean; permissions: string[] };

export const NOMS_MODULES: Record<string, string> = {
  utilisateurs: "Utilisateurs",
  roles: "Rôles et permissions",
  personnalisation: "Personnalisation",
  actualites: "Actualités",
  annonces: "Annonces",
  articles: "Articles",
  notes_service: "Notes de service",
  annuaire: "Annuaire et organigramme",
  documents: "Documents",
  calendrier: "Calendrier",
  evenements: "Événements",
  faq: "FAQ",
  formulaires: "Formulaires internes",
  pages: "Pages internes",
};

export const nomModule = (code: string) => NOMS_MODULES[code] ?? code;

type Groupe = { code: string; permissions: PermissionCatalogue[] };

function CaseModule({
  groupe,
  selection,
  detenues,
  actif,
  verrouille,
  onBasculerModule,
  onBasculer,
}: {
  groupe: Groupe;
  selection: Set<string>;
  detenues: Set<string>;
  actif: boolean;
  verrouille: boolean;
  onBasculerModule: (codes: string[], cocher: boolean) => void;
  onBasculer: (code: string) => void;
}) {
  const modifiables = groupe.permissions.filter((p) => detenues.has(p.code_permission)).map((p) => p.code_permission);
  const nbCochees = modifiables.filter((c) => selection.has(c)).length;
  const toutes = modifiables.length > 0 && nbCochees === modifiables.length;
  const partiel = nbCochees > 0 && !toutes;
  const caseRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (caseRef.current) caseRef.current.indeterminate = partiel;
  }, [partiel]);

  const idModule = `m-${groupe.code}`;

  return (
    <fieldset className="rounded-xl border border-site-line bg-site-base/40">
      <legend className="sr-only">{nomModule(groupe.code)}</legend>
      <div className="flex items-center gap-3 border-b border-site-line px-4 py-3">
        <input
          id={idModule}
          ref={caseRef}
          type="checkbox"
          checked={toutes}
          disabled={verrouille || modifiables.length === 0}
          onChange={() => onBasculerModule(modifiables, !toutes)}
          className="size-4 shrink-0 accent-brand-violet disabled:opacity-50"
        />
        <label htmlFor={idModule} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {nomModule(groupe.code)}
        </label>
        {!actif && (
          <span className="shrink-0 rounded-full border border-dashed border-site-line px-2 py-0.5 text-[10px] font-medium text-site-muted">
            Module inactif
          </span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-site-muted">
          {groupe.permissions.filter((p) => selection.has(p.code_permission)).length}/{groupe.permissions.length}
        </span>
      </div>
      <ul className="divide-y divide-site-line/60">
        {groupe.permissions.map((p) => {
          const possedee = detenues.has(p.code_permission);
          const id = `p-${p.code_permission}`;
          return (
            <li key={p.code_permission} className="flex items-center gap-3 px-4 py-2.5 pl-11">
              <input
                id={id}
                type="checkbox"
                checked={selection.has(p.code_permission)}
                disabled={verrouille || !possedee}
                onChange={() => onBasculer(p.code_permission)}
                className="size-4 shrink-0 accent-brand-violet disabled:opacity-50"
              />
              <label htmlFor={id} className={cn("min-w-0 flex-1 text-sm", !possedee && "text-site-muted")}>
                {p.libelle_permission}
              </label>
              {!possedee && !verrouille && (
                <span title="Vous ne possédez pas cette permission" className="shrink-0 text-site-muted">
                  <Lock size={13} aria-hidden />
                  <span className="sr-only">Vous ne possédez pas cette permission</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

type Props = {
  role: Role | null;
  catalogue: PermissionCatalogue[];
  onFermer: () => void;
  onEnregistre: (message: string) => void;
};

export function RoleFormulaire({ role, catalogue, onFermer, onEnregistre }: Props) {
  const { profil, token, expirer } = useEspace();
  const edition = role !== null;

  const [nom, setNom] = useState(role?.nom_role ?? "");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [detenuesRole, setDetenuesRole] = useState<string[]>([]);
  const [chargement, setChargement] = useState(edition);
  const [echecChargement, setEchecChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  const detenues = useMemo(() => new Set(profil.permissions), [profil.permissions]);
  const modulesActifs = useMemo(() => new Set(profil.modules_actifs), [profil.modules_actifs]);

  const roleId = role?.id ?? null;
  useEffect(() => {
    if (roleId === null) return;
    let annule = false;
    api<RoleDetail>(`/roles/${roleId}`, { token })
      .then((d) => {
        if (annule) return;
        setNom(d.nom_role);
        setSelection(new Set(d.permissions));
        setDetenuesRole(d.permissions);
        setChargement(false);
      })
      .catch((e) => {
        if (annule) return;
        if (e instanceof ApiError && e.status === 401) {
          expirer();
          return;
        }
        setMessage(messageErreur(e));
        setEchecChargement(true);
        setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [roleId, token, expirer]);

  useEffect(() => {
    if (!chargement) premierChamp.current?.focus();
  }, [chargement]);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = defilement;
    };
  }, [onFermer]);

  const groupes = useMemo<Groupe[]>(() => {
    const parModule = new Map<string, PermissionCatalogue[]>();
    for (const p of catalogue) parModule.set(p.code_module, [...(parModule.get(p.code_module) ?? []), p]);
    return [...parModule.entries()].map(([code, permissions]) => ({ code, permissions }));
  }, [catalogue]);

  const parDefaut = role?.role_par_defaut ?? false;
  const depasse = edition && detenuesRole.some((c) => !detenues.has(c));
  const verrouille = edition && (parDefaut || depasse || echecChargement);

  const err = (champ: string) => erreurs[champ]?.[0];
  const erreurPermissions = Object.entries(erreurs).find(([k]) => k.startsWith("permissions"))?.[1][0];

  function basculer(code: string) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  function basculerModule(codes: string[], cocher: boolean) {
    setSelection((s) => {
      const n = new Set(s);
      for (const c of codes) {
        if (cocher) n.add(c);
        else n.delete(c);
      }
      return n;
    });
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi || verrouille) return;
    setErreurs({});
    setMessage(null);

    if (selection.size === 0) {
      setErreurs({ permissions: ["Sélectionnez au moins une permission."] });
      setMessage("Certains champs sont à corriger.");
      return;
    }

    setEnvoi(true);
    const permissions = catalogue.map((p) => p.code_permission).filter((c) => selection.has(c));

    try {
      await api<RoleDetail>(edition ? `/roles/${role.id}` : "/roles", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify({ nom_role: nom.trim(), permissions }),
      });
      onEnregistre(edition ? "Rôle modifié." : "Rôle créé.");
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 401) {
        expirer();
        return;
      }
      if (e2 instanceof ApiError && e2.errors) {
        setErreurs(e2.errors);
        setMessage("Certains champs sont à corriger.");
      } else {
        setMessage(messageErreur(e2));
      }
      setEnvoi(false);
    }
  }

  const titre = !edition ? "Nouveau rôle" : verrouille ? "Détail du rôle" : "Modifier le rôle";

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-role">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <form
        onSubmit={soumettre}
        noValidate
        className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-site-line bg-site-surface shadow-2xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-formulaire-role" className="font-display text-base font-semibold">
            {titre}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {message && (
            <p
              role="alert"
              className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger"
            >
              {message}
            </p>
          )}

          {edition && !chargement && !echecChargement && verrouille && (
            <p className="flex items-start gap-2 rounded-lg border border-site-line bg-site-base/60 px-3 py-2 text-xs text-site-muted">
              <Lock size={14} aria-hidden className="mt-0.5 shrink-0" />
              {parDefaut
                ? "Ce rôle est un rôle par défaut : il n’est pas modifiable."
                : "Ce rôle possède des permissions que vous ne détenez pas : vous ne pouvez pas le modifier."}
            </p>
          )}

          {chargement ? (
            <div aria-hidden className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-site-line" />
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-site-line/70" />
              ))}
            </div>
          ) : echecChargement ? null : (
            <>
              <div>
                <label htmlFor="r-nom" className="mb-1.5 block text-xs font-medium text-site-muted">
                  Nom du rôle{!verrouille && <span className="text-site-danger"> *</span>}
                </label>
                <input
                  id="r-nom"
                  ref={premierChamp}
                  className={CHAMP}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  readOnly={verrouille}
                />
                {err("nom_role") && <p className="mt-1 text-xs text-site-danger">{err("nom_role")}</p>}
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-xs font-medium text-site-muted">
                    Permissions{!verrouille && <span className="text-site-danger"> *</span>}
                  </h3>
                  <span className="text-xs tabular-nums text-site-muted">
                    {selection.size} / {catalogue.length} sélectionnée{selection.size > 1 ? "s" : ""}
                  </span>
                </div>
                {!verrouille && (
                  <p className="mb-3 text-[11px] text-site-muted">
                    Vous pouvez accorder uniquement les permissions que vous possédez vous-même.
                  </p>
                )}
                <div className="space-y-3">
                  {groupes.map((g) => (
                    <CaseModule
                      key={g.code}
                      groupe={g}
                      selection={selection}
                      detenues={detenues}
                      actif={modulesActifs.has(g.code)}
                      verrouille={verrouille}
                      onBasculerModule={basculerModule}
                      onBasculer={basculer}
                    />
                  ))}
                </div>
                {erreurPermissions && <p className="mt-2 text-xs text-site-danger">{erreurPermissions}</p>}
              </div>
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-site-line px-5 py-4">
          <button
            type="button"
            onClick={onFermer}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
          >
            {verrouille ? "Fermer" : "Annuler"}
          </button>
          {!verrouille && (
            <button
              type="submit"
              disabled={envoi || chargement}
              className={cn(
                "v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold",
                (envoi || chargement) && "opacity-70",
              )}
            >
              {envoi && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {edition ? "Enregistrer" : "Créer le rôle"}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

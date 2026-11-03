"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";

export type ModuleFormulaire = {
  code_module: string;
  nom_module: string;
  description_module: string | null;
  permissions: { code_permission: string; libelle_permission: string }[];
};

type Props = {
  /** null : création d'un nouveau module ; sinon modification (le code reste figé). */
  module: ModuleFormulaire | null;
  onFermer: () => void;
  onEnregistre: (texte: string) => void;
};

export function ModuleCatalogueFormulaire({ module, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = module !== null;
  const [code, setCode] = useState(module?.code_module ?? "");
  const [nom, setNom] = useState(module?.nom_module ?? "");
  const [description, setDescription] = useState(module?.description_module ?? "");
  const [permissions, setPermissions] = useState(module?.permissions ?? []);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const surTouche = (ev: KeyboardEvent) => ev.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  const modifierPermission = (i: number, cle: "code_permission" | "libelle_permission", valeur: string) =>
    setPermissions((liste) => liste.map((p, j) => (j === i ? { ...p, [cle]: valeur } : p)));

  async function envoyer(ev: FormEvent) {
    ev.preventDefault();
    setEnCours(true);
    setErreur(null);
    setChamps({});
    const corps = {
      ...(edition ? {} : { code_module: code.trim() }),
      nom_module: nom.trim(),
      description_module: description.trim() || null,
      permissions: permissions
        .filter((p) => p.code_permission.trim() || p.libelle_permission.trim())
        .map((p) => ({ code_permission: p.code_permission.trim(), libelle_permission: p.libelle_permission.trim() })),
    };
    try {
      await api(edition ? `/super/modules/${module.code_module}` : "/super/modules", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify(corps),
      });
      onEnregistre(edition ? `Le module « ${corps.nom_module} » a été modifié.` : `Le module « ${corps.nom_module} » a été ajouté.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expirer();
        return;
      }
      if (err instanceof ApiError && err.errors) setChamps(err.errors);
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  const erreurChamp = (cle: string) => champs[cle]?.[0];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titre-module-form">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <form
        onSubmit={envoyer}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-site-line bg-site-surface shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-site-line px-5 py-4">
          <h2 id="titre-module-form" className="font-display text-base font-semibold">
            {edition ? "Modifier le module" : "Ajouter un module"}
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onFermer}
            className="inline-flex size-9 items-center justify-center rounded-full text-site-muted hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <label htmlFor="module-nom" className="mb-1 block text-xs font-medium text-site-muted">
              Nom
            </label>
            <input id="module-nom" className={CHAMP} value={nom} maxLength={50} required onChange={(e) => setNom(e.target.value)} />
            {erreurChamp("nom_module") && <p className="mt-1 text-xs text-site-danger">{erreurChamp("nom_module")}</p>}
          </div>

          <div>
            <label htmlFor="module-code" className="mb-1 block text-xs font-medium text-site-muted">
              Code unique {edition && "(non modifiable)"}
            </label>
            <input
              id="module-code"
              className={`${CHAMP} font-mono`}
              value={code}
              maxLength={30}
              required
              disabled={edition}
              placeholder="ex. sondages"
              onChange={(e) => setCode(e.target.value.toLowerCase())}
            />
            {erreurChamp("code_module") && <p className="mt-1 text-xs text-site-danger">{erreurChamp("code_module")}</p>}
          </div>

          <div>
            <label htmlFor="module-description" className="mb-1 block text-xs font-medium text-site-muted">
              Description
            </label>
            <textarea
              id="module-description"
              className={`${CHAMP} h-20 py-2`}
              value={description}
              maxLength={250}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-medium text-site-muted">Permissions associées</legend>
            <div className="space-y-2">
              {permissions.map((p, i) => (
                <div key={i}>
                  <div className="flex gap-2">
                    <input
                      aria-label={`Code de la permission ${i + 1}`}
                      className={`${CHAMP} font-mono`}
                      value={p.code_permission}
                      placeholder={`${code || "module"}.consulter`}
                      onChange={(e) => modifierPermission(i, "code_permission", e.target.value.toLowerCase())}
                    />
                    <input
                      aria-label={`Libellé de la permission ${i + 1}`}
                      className={CHAMP}
                      value={p.libelle_permission}
                      placeholder="Libellé"
                      onChange={(e) => modifierPermission(i, "libelle_permission", e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={`Retirer la permission ${i + 1} du formulaire`}
                      onClick={() => setPermissions((l) => l.filter((_, j) => j !== i))}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-site-muted hover:bg-site-surface2 hover:text-site-danger"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                  {(erreurChamp(`permissions.${i}.code_permission`) || erreurChamp(`permissions.${i}.libelle_permission`)) && (
                    <p className="mt-1 text-xs text-site-danger">
                      {erreurChamp(`permissions.${i}.code_permission`) ?? erreurChamp(`permissions.${i}.libelle_permission`)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {edition && (
              <p className="mt-2 text-[11px] text-site-muted">
                Les permissions existantes ne sont pas supprimées ici : seules les permissions saisies sont ajoutées ou mises à jour.
              </p>
            )}
            <button
              type="button"
              onClick={() => setPermissions((l) => [...l, { code_permission: "", libelle_permission: "" }])}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-site-line px-3 py-1 text-xs font-semibold hover:border-brand-violet/60"
            >
              <Plus size={14} aria-hidden />
              Ajouter une permission
            </button>
          </fieldset>

          {erreur && (
            <p role="alert" className="rounded-lg bg-site-danger/10 px-3 py-2 text-sm text-site-danger">
              {erreur}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-site-line px-5 py-4">
          <button type="button" onClick={onFermer} className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold hover:border-brand-violet/60">
            Annuler
          </button>
          <button type="submit" disabled={enCours} className="v-gradient-btn h-10 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

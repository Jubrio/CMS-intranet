"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { initiales } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";

export type Departement = {
  id: number;
  nom_departement: string;
  description_departement: string | null;
  departement_parent_id: number | null;
  responsable_id: number | null;
  responsable: { id: number; nom: string; prenom: string } | null;
  nb_employes: number;
};

type Personne = { id: number; nom: string; prenom: string; poste: string | null; email: string };
type PageUtilisateurs = { data: Personne[] };

function Champ({
  id,
  label,
  erreur,
  requis,
  aide,
  children,
}: {
  id: string;
  label: string;
  erreur?: string;
  requis?: boolean;
  aide?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-site-muted">
        {label}
        {requis && <span className="text-site-danger"> *</span>}
      </label>
      {children}
      {aide && !erreur && <p className="mt-1 text-[11px] text-site-muted">{aide}</p>}
      {erreur && <p className="mt-1 text-xs text-site-danger">{erreur}</p>}
    </div>
  );
}

// Choix du responsable : recherche dans les comptes actifs de l'entreprise
function SelecteurResponsable({
  choisi,
  onChoisir,
  erreur,
}: {
  choisi: { id: number; libelle: string } | null;
  onChoisir: (p: { id: number; libelle: string } | null) => void;
  erreur?: string;
}) {
  const { token } = useEspace();
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<Personne[]>([]);
  const [chargement, setChargement] = useState(false);
  const [indisponible, setIndisponible] = useState(false);
  const terme = saisie.trim();

  useEffect(() => {
    if (terme.length < 2) return;
    let annule = false;
    const t = setTimeout(() => {
      setChargement(true);
      api<PageUtilisateurs>(`/utilisateurs?statut=actif&q=${encodeURIComponent(terme)}`, { token })
        .then((r) => {
          if (annule) return;
          setResultats(r.data);
          setChargement(false);
        })
        .catch((err) => {
          if (annule) return;
          setChargement(false);
          setResultats([]);
          if (err instanceof ApiError && err.status === 403) setIndisponible(true);
        });
    }, 300);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [terme, token]);

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-site-muted">Responsable</span>

      {choisi ? (
        <div className="flex items-center gap-3 rounded-lg border border-site-line bg-site-base/60 px-3 py-2">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-[11px] font-bold text-brand-violet"
          >
            {choisi.libelle
              .split(" ")
              .map((m) => m.charAt(0))
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{choisi.libelle}</span>
          <button
            type="button"
            onClick={() => onChoisir(null)}
            aria-label="Retirer le responsable"
            className="flex size-7 items-center justify-center rounded-md text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      ) : indisponible ? (
        <p className="rounded-lg border border-site-line px-3 py-2 text-xs text-site-muted">
          Votre rôle ne permet pas de rechercher des comptes pour désigner un responsable.
        </p>
      ) : (
        <div>
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted"
            />
            <input
              type="search"
              value={saisie}
              onChange={(e) => {
                setSaisie(e.target.value);
                if (e.target.value.trim().length < 2) setResultats([]);
              }}
              placeholder="Rechercher un compte actif (2 lettres minimum)"
              aria-label="Rechercher un responsable"
              className={cn(CHAMP, "pl-9")}
              autoComplete="off"
            />
          </div>
          {terme.length >= 2 && (
            <ul className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-site-line bg-site-surface2">
              {chargement ? (
                <li className="px-3 py-2.5 text-xs text-site-muted">Recherche…</li>
              ) : resultats.length === 0 ? (
                <li className="px-3 py-2.5 text-xs text-site-muted">Aucun compte actif trouvé.</li>
              ) : (
                resultats.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChoisir({ id: p.id, libelle: `${p.prenom} ${p.nom}` });
                        setSaisie("");
                        setResultats([]);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-site-line/50"
                    >
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-violet/15 text-[11px] font-bold text-brand-violet"
                      >
                        {initiales(p)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {p.prenom} {p.nom}
                        </span>
                        <span className="block truncate text-xs text-site-muted">{p.poste ?? p.email}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
      {erreur && <p className="mt-1 text-xs text-site-danger">{erreur}</p>}
    </div>
  );
}

type Props = {
  departement: Departement | null; // null = création
  tous: Departement[];
  onFermer: () => void;
  onEnregistre: (message: string) => void;
};

// Identifiants du département et de tous ses descendants (ils ne peuvent pas devenir son parent)
function descendants(id: number, tous: Departement[]): Set<number> {
  const resultat = new Set<number>([id]);
  let ajout = true;
  while (ajout) {
    ajout = false;
    for (const d of tous) {
      if (d.departement_parent_id !== null && resultat.has(d.departement_parent_id) && !resultat.has(d.id)) {
        resultat.add(d.id);
        ajout = true;
      }
    }
  }
  return resultat;
}

export function DepartementFormulaire({ departement, tous, onFermer, onEnregistre }: Props) {
  const { token, expirer } = useEspace();
  const edition = departement !== null;

  const [nom, setNom] = useState(departement?.nom_departement ?? "");
  const [description, setDescription] = useState(departement?.description_departement ?? "");
  const [parentId, setParentId] = useState(
    departement?.departement_parent_id ? String(departement.departement_parent_id) : "",
  );
  const [responsable, setResponsable] = useState<{ id: number; libelle: string } | null>(
    departement?.responsable
      ? { id: departement.responsable.id, libelle: `${departement.responsable.prenom} ${departement.responsable.nom}` }
      : null,
  );
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    premierChamp.current?.focus();
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

  const exclus = departement ? descendants(departement.id, tous) : new Set<number>();
  const parentsPossibles = tous.filter((d) => !exclus.has(d.id));
  const err = (champ: string) => erreurs[champ]?.[0];

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    setErreurs({});
    setMessage(null);

    const corps = {
      nom_departement: nom.trim(),
      description_departement: description.trim() || null,
      departement_parent_id: parentId ? Number(parentId) : null,
      responsable_id: responsable?.id ?? null,
    };

    try {
      await api<Departement>(edition ? `/departements/${departement.id}` : "/departements", {
        method: edition ? "PUT" : "POST",
        token,
        body: JSON.stringify(corps),
      });
      onEnregistre(edition ? "Département modifié." : "Département créé.");
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

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-formulaire-dep">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <form
        onSubmit={soumettre}
        noValidate
        className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-formulaire-dep" className="font-display text-base font-semibold">
            {edition ? "Modifier le département" : "Nouveau département"}
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {message && (
            <p
              role="alert"
              className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger"
            >
              {message}
            </p>
          )}

          <Champ id="d-nom" label="Nom du département" requis erreur={err("nom_departement")}>
            <input
              id="d-nom"
              ref={premierChamp}
              className={CHAMP}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              maxLength={150}
              autoComplete="off"
            />
          </Champ>

          <Champ
            id="d-desc"
            label="Description"
            erreur={err("description_departement")}
            aide={`${description.length} / 1000`}
          >
            <textarea
              id="d-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              className={cn(CHAMP, "h-auto resize-y py-2")}
            />
          </Champ>

          <Champ
            id="d-parent"
            label="Département parent"
            erreur={err("departement_parent_id")}
            aide="Laissez vide pour un département de premier niveau."
          >
            <select id="d-parent" className={CHAMP} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Aucun (premier niveau)</option>
              {parentsPossibles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom_departement}
                </option>
              ))}
            </select>
          </Champ>

          <SelecteurResponsable choisi={responsable} onChoisir={setResponsable} erreur={err("responsable_id")} />
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-site-line px-5 py-4">
          <button
            type="button"
            onClick={onFermer}
            className="h-10 rounded-full border border-site-line px-5 text-sm font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
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
            {edition ? "Enregistrer" : "Créer le département"}
          </button>
        </footer>
      </form>
    </div>
  );
}

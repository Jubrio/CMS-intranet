"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  Camera,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, ApiError, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { useDonnees } from "./use-donnees";
import { CHAMP } from "./utilisateur-formulaire";
import {
  Avatar,
  formaterDate,
  libelleDepartement,
  normaliser,
  type Employe,
  type Fiche,
  type LienEmploye,
  type OptionDepartement,
  type Pagination,
} from "./annuaire-commun";

const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"];
const POIDS_MAX_PHOTO = 2 * 1024 * 1024; // RG25 : 2 Mo

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

// ---- Choix du supérieur : recherche dans l'annuaire -----------------------------------

function ChoixSuperieur({
  soiId,
  valeur,
  onChoisir,
}: {
  soiId: number;
  valeur: LienEmploye | null;
  onChoisir: (p: LienEmploye | null) => void;
}) {
  const { token, expirer } = useEspace();
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<Employe[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [echec, setEchec] = useState(false);

  const terme = saisie.trim();

  useEffect(() => {
    if (terme.length < 2) return;
    let annule = false;
    const t = setTimeout(() => {
      setRecherche(true);
      // Le serveur cherche le texte entier dans chaque champ : on lui envoie le mot le plus long,
      // puis on affine ci-dessous avec tous les mots saisis (« Jean Dupont »).
      const mot = [...terme.split(/\s+/)].sort((a, b) => b.length - a.length)[0];
      api<Pagination<Employe>>(`/annuaire?q=${encodeURIComponent(mot)}`, { token })
        .then((res) => {
          if (annule) return;
          setResultats(res.data);
          setEchec(false);
          setRecherche(false);
        })
        .catch((err) => {
          if (annule) return;
          if (err instanceof ApiError && err.status === 401) {
            expirer();
            return;
          }
          setEchec(true);
          setRecherche(false);
        });
    }, 300);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [terme, token, expirer]);

  const visibles = useMemo(() => {
    if (terme.length < 2) return [];
    const jetons = normaliser(terme).split(/\s+/);
    return resultats
      .filter((e) => e.id !== soiId)
      .filter((e) => {
        const texte = normaliser(`${e.prenom} ${e.nom} ${e.poste ?? ""} ${e.nom_departement ?? ""}`);
        return jetons.every((j) => texte.includes(j));
      })
      .slice(0, 6);
  }, [resultats, terme, soiId]);

  if (valeur) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-site-line bg-site-base/60 px-3 py-2">
        <Avatar personne={{ prenom: valeur.prenom, nom: valeur.nom }} taille="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {valeur.prenom} {valeur.nom}
          </p>
          {valeur.poste && <p className="truncate text-xs text-site-muted">{valeur.poste}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChoisir(null)}
          aria-label="Retirer le supérieur"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-site-muted"
        />
        <input
          id="f-superieur"
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Rechercher un nom, un poste…"
          autoComplete="off"
          className={cn(CHAMP, "pl-9")}
        />
      </div>
      {terme.length >= 2 && (
        <ul className="mt-2 divide-y divide-site-line overflow-hidden rounded-lg border border-site-line bg-site-base/40">
          {echec ? (
            <li className="px-3 py-2.5 text-xs text-site-danger">La recherche a échoué. Réessayez.</li>
          ) : recherche ? (
            <li className="px-3 py-2.5 text-xs text-site-muted">Recherche en cours…</li>
          ) : visibles.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-site-muted">Aucune personne trouvée.</li>
          ) : (
            visibles.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChoisir({ id: e.id, nom: e.nom, prenom: e.prenom, poste: e.poste });
                    setSaisie("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-site-surface2"
                >
                  <Avatar personne={e} taille="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {e.prenom} {e.nom}
                    </span>
                    <span className="block truncate text-xs text-site-muted">
                      {[e.poste, e.nom_departement].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ---- Formulaire de modification ------------------------------------------------------

type PropsFormulaire = {
  fiche: Fiche;
  departements: OptionDepartement[];
  onAnnuler: () => void;
  onEnregistre: () => void;
  onPhoto: (chemin: string) => void;
};

function FormulaireFiche({ fiche, departements, onAnnuler, onEnregistre, onPhoto }: PropsFormulaire) {
  const { token, expirer } = useEspace();

  const [prenom, setPrenom] = useState(fiche.prenom);
  const [nom, setNom] = useState(fiche.nom);
  const [poste, setPoste] = useState(fiche.poste ?? "");
  const [telephone, setTelephone] = useState(fiche.telephone ?? "");
  const [departementId, setDepartementId] = useState(fiche.departement_id ? String(fiche.departement_id) : "");
  const [superieur, setSuperieur] = useState<LienEmploye | null>(fiche.superieur);
  const [photo, setPhoto] = useState(fiche.photo);
  const [televersement, setTeleversement] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const champPhoto = useRef<HTMLInputElement>(null);
  const premierChamp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    premierChamp.current?.focus();
  }, []);

  const err = (champ: string) => erreurs[champ]?.[0];

  // Le département actuel reste proposé même si la liste n'a pas pu être chargée
  const options = useMemo(() => {
    if (fiche.departement_id && fiche.nom_departement && !departements.some((d) => d.id === fiche.departement_id)) {
      return [...departements, { id: fiche.departement_id, nom_departement: fiche.nom_departement, profondeur: 0 }];
    }
    return departements;
  }, [departements, fiche.departement_id, fiche.nom_departement]);

  async function choisirPhoto(fichier: File | undefined) {
    if (!fichier) return;
    setErreurPhoto(null);
    if (!TYPES_PHOTO.includes(fichier.type)) {
      setErreurPhoto("Format non accepté. Utilisez une image JPG, PNG ou WebP.");
      return;
    }
    if (fichier.size > POIDS_MAX_PHOTO) {
      setErreurPhoto("La photo dépasse 2 Mo.");
      return;
    }
    setTeleversement(true);
    try {
      const donnees = new FormData();
      donnees.append("photo", fichier);
      const res = await api<{ photo: string; url: string }>(`/annuaire/${fiche.id}/photo`, {
        method: "POST",
        token,
        body: donnees,
      });
      setPhoto(res.photo);
      onPhoto(res.photo);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return;
      }
      setErreurPhoto(e instanceof ApiError && e.errors?.photo?.[0] ? e.errors.photo[0] : messageErreur(e));
    } finally {
      setTeleversement(false);
      if (champPhoto.current) champPhoto.current.value = "";
    }
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setErreurs({});
    setMessage(null);

    const locales: Record<string, string[]> = {};
    if (!prenom.trim()) locales.prenom = ["Le prénom est obligatoire."];
    if (!nom.trim()) locales.nom = ["Le nom est obligatoire."];
    if (Object.keys(locales).length > 0) {
      setErreurs(locales);
      setMessage("Certains champs sont à corriger.");
      return;
    }

    setEnvoi(true);
    try {
      await api<unknown>(`/annuaire/${fiche.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          prenom: prenom.trim(),
          nom: nom.trim(),
          poste: poste.trim() || null,
          telephone: telephone.trim() || null,
          departement_id: departementId ? Number(departementId) : null,
          superieur_id: superieur ? superieur.id : null,
        }),
      });
      onEnregistre();
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
    <form onSubmit={soumettre} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {message && (
          <p
            role="alert"
            className="rounded-lg border border-site-danger/40 bg-site-danger/10 px-3 py-2 text-sm text-site-danger"
          >
            {message}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Avatar personne={{ prenom: fiche.prenom, nom: fiche.nom, photo }} taille="lg" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => champPhoto.current?.click()}
              disabled={televersement}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60 disabled:opacity-60"
            >
              {televersement ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Camera size={14} aria-hidden />
              )}
              {photo ? "Changer la photo" : "Ajouter une photo"}
            </button>
            <input
              ref={champPhoto}
              type="file"
              accept={TYPES_PHOTO.join(",")}
              className="sr-only"
              aria-label="Choisir une photo"
              onChange={(e) => choisirPhoto(e.target.files?.[0])}
            />
            {erreurPhoto ? (
              <p className="mt-1.5 text-xs text-site-danger">{erreurPhoto}</p>
            ) : (
              <p className="mt-1.5 text-[11px] text-site-muted">
                JPG, PNG ou WebP, 2 Mo au maximum. Enregistrée aussitôt.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ id="f-prenom" label="Prénom" requis erreur={err("prenom")}>
            <input
              id="f-prenom"
              ref={premierChamp}
              className={CHAMP}
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              maxLength={60}
              autoComplete="off"
            />
          </Champ>
          <Champ id="f-nom" label="Nom" requis erreur={err("nom")}>
            <input
              id="f-nom"
              className={CHAMP}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              maxLength={50}
              autoComplete="off"
            />
          </Champ>
        </div>

        <Champ id="f-poste" label="Poste" erreur={err("poste")}>
          <input
            id="f-poste"
            className={CHAMP}
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
            maxLength={100}
            autoComplete="off"
          />
        </Champ>

        <Champ id="f-tel" label="Téléphone" erreur={err("telephone")}>
          <input
            id="f-tel"
            type="tel"
            className={CHAMP}
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </Champ>

        <Champ id="f-dep" label="Département" erreur={err("departement_id")}>
          <select id="f-dep" className={CHAMP} value={departementId} onChange={(e) => setDepartementId(e.target.value)}>
            <option value="">Aucun département</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {libelleDepartement(d)}
              </option>
            ))}
          </select>
        </Champ>

        <Champ
          id="f-superieur"
          label="Supérieur hiérarchique"
          erreur={err("superieur_id")}
          aide="Une personne ne peut pas dépendre d’un de ses subordonnés."
        >
          <ChoixSuperieur soiId={fiche.id} valeur={superieur} onChoisir={setSuperieur} />
        </Champ>

        <p className="rounded-lg border border-site-line bg-site-base/40 px-3 py-2 text-xs text-site-muted">
          L’adresse e-mail, le rôle et le statut du compte se modifient depuis l’écran Utilisateurs.
        </p>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-site-line px-5 py-4">
        <button
          type="button"
          onClick={onAnnuler}
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
          Enregistrer
        </button>
      </footer>
    </form>
  );
}

// ---- Panneau : lecture de la fiche, puis modification ---------------------------------

function Ligne({ icone: Icone, libelle, children }: { icone: typeof Mail; libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-violet/15 text-brand-violet">
        <Icone size={16} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-site-muted">{libelle}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function BoutonPersonne({ p, onClick }: { p: LienEmploye; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-site-line px-3 py-2 text-left transition-colors hover:border-brand-violet/60 hover:bg-site-surface2/50"
    >
      <Avatar personne={{ prenom: p.prenom, nom: p.nom }} taille="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {p.prenom} {p.nom}
        </span>
        {p.poste && <span className="block truncate text-xs text-site-muted">{p.poste}</span>}
      </span>
    </button>
  );
}

type Props = {
  id: number;
  departements: OptionDepartement[];
  onFermer: () => void;
  onOuvrir: (id: number) => void;
  onVoirEquipe: (departementId: number) => void;
  onModifie: (message?: string) => void;
};

export function AnnuaireFiche({ id, departements, onFermer, onOuvrir, onVoirEquipe, onModifie }: Props) {
  const [edition, setEdition] = useState(false);
  const [version, setVersion] = useState(0);

  const charger = useCallback(
    async (jeton: string) => {
      void version;
      return api<Fiche>(`/annuaire/${id}`, { token: jeton });
    },
    [id, version],
  );
  const { donnees: fiche, chargement, erreur, reessayer } = useDonnees(true, charger);

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

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-fiche">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-fiche" className="font-display text-base font-semibold">
            {edition ? "Modifier la fiche" : "Fiche employé"}
          </h2>
          <div className="flex items-center gap-1">
            {fiche && !edition && (
              <button
                type="button"
                onClick={() => setEdition(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
              >
                <Pencil size={14} aria-hidden />
                Modifier
              </button>
            )}
            <button
              type="button"
              onClick={onFermer}
              aria-label="Fermer"
              className="flex size-8 items-center justify-center rounded-lg text-site-muted transition-colors hover:bg-site-surface2 hover:text-site-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        {erreur ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-site-muted">
            <span>Cette fiche n’est pas disponible. La personne a peut-être été désactivée.</span>
            <button
              type="button"
              onClick={reessayer}
              className="inline-flex items-center rounded-full border border-site-line px-3 py-1 text-xs font-semibold text-site-ink transition-colors hover:border-brand-violet/60"
            >
              Réessayer
            </button>
          </div>
        ) : chargement || !fiche ? (
          <div className="space-y-4 p-6" aria-hidden>
            <div className="flex items-center gap-4">
              <div className="size-20 animate-pulse rounded-full bg-site-line" />
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded-md bg-site-line" />
                <div className="h-3 w-28 animate-pulse rounded-md bg-site-line" />
              </div>
            </div>
            <div className="h-3 w-56 animate-pulse rounded-md bg-site-line" />
            <div className="h-3 w-44 animate-pulse rounded-md bg-site-line" />
          </div>
        ) : edition ? (
          <FormulaireFiche
            fiche={fiche}
            departements={departements}
            onAnnuler={() => setEdition(false)}
            onPhoto={() => onModifie()}
            onEnregistre={() => {
              setEdition(false);
              setVersion((v) => v + 1);
              onModifie("La fiche a été mise à jour.");
            }}
          />
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
            <div className="flex items-center gap-4">
              <Avatar personne={fiche} taille="lg" />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold leading-tight">
                  {fiche.prenom} {fiche.nom}
                </p>
                <p className="mt-0.5 text-sm text-site-muted">{fiche.poste || "Poste non renseigné"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Ligne icone={Building2} libelle="Département">
                {fiche.departement_id && fiche.nom_departement ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {fiche.nom_departement}
                    <button
                      type="button"
                      onClick={() => onVoirEquipe(fiche.departement_id as number)}
                      className="text-xs font-semibold text-brand-violet hover:underline"
                    >
                      Voir l’équipe
                    </button>
                  </span>
                ) : (
                  <span className="text-site-muted">Aucun département</span>
                )}
              </Ligne>
              <Ligne icone={Mail} libelle="E-mail">
                <a href={`mailto:${fiche.email}`} className="break-all hover:underline">
                  {fiche.email}
                </a>
              </Ligne>
              <Ligne icone={Phone} libelle="Téléphone">
                {fiche.telephone ? (
                  <a href={`tel:${fiche.telephone.replace(/\s+/g, "")}`} className="hover:underline">
                    {fiche.telephone}
                  </a>
                ) : (
                  <span className="text-site-muted">Non renseigné</span>
                )}
              </Ligne>
              <Ligne icone={CalendarDays} libelle="Date d’embauche">
                {formaterDate(fiche.date_embauche) ?? <span className="text-site-muted">Non renseignée</span>}
              </Ligne>
            </div>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-site-muted">
                <UserRound size={14} aria-hidden />
                Supérieur hiérarchique
              </h3>
              {fiche.superieur ? (
                <BoutonPersonne p={fiche.superieur} onClick={() => onOuvrir(fiche.superieur!.id)} />
              ) : (
                <p className="text-sm text-site-muted">Aucun supérieur renseigné.</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-site-muted">
                <Users size={14} aria-hidden />
                Subordonnés directs{fiche.subordonnes.length > 0 && ` (${fiche.subordonnes.length})`}
              </h3>
              {fiche.subordonnes.length === 0 ? (
                <p className="text-sm text-site-muted">Aucun subordonné direct.</p>
              ) : (
                <ul className="space-y-2">
                  {fiche.subordonnes.map((s) => (
                    <li key={s.id}>
                      <BoutonPersonne p={s} onClick={() => onOuvrir(s.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

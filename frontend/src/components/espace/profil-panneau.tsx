"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Building2, Camera, Loader2, Mail, ShieldCheck, X } from "lucide-react";
import { api, ApiError, messageErreur, urlStockage } from "@/lib/api";
import { initiales, type Profil } from "@/lib/espace";
import { cn } from "@/lib/utils";
import { useEspace } from "./espace-context";
import { CHAMP } from "./utilisateur-formulaire";

const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"];
const POIDS_MAX_PHOTO = 2 * 1024 * 1024; // RG25 : 2 Mo

const TAILLES = { md: "size-10 text-xs", lg: "size-20 text-2xl" } as const;

// Photo de la personne, ou ses initiales sur le dégradé de l'entreprise
export function PastilleProfil({
  profil,
  taille = "md",
}: {
  profil: Pick<Profil, "prenom" | "nom" | "photo">;
  taille?: keyof typeof TAILLES;
}) {
  const [echec, setEchec] = useState<string | null>(null);
  const afficher = profil.photo && echec !== profil.photo;

  return (
    <span
      aria-hidden
      className={cn(
        "v-gradient-btn flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        TAILLES[taille],
      )}
    >
      {afficher ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlStockage(profil.photo as string)}
          alt=""
          className="size-full object-cover"
          onError={() => setEchec(profil.photo ?? null)}
        />
      ) : (
        initiales(profil)
      )}
    </span>
  );
}

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

function Bandeau({ notice, onFermer }: { notice: { type: "ok" | "erreur"; texte: string }; onFermer: () => void }) {
  return (
    <p
      role={notice.type === "erreur" ? "alert" : "status"}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
        notice.type === "ok"
          ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
          : "border-site-danger/40 bg-site-danger/10 text-site-danger",
      )}
    >
      {notice.texte}
      <button
        type="button"
        aria-label="Masquer le message"
        onClick={onFermer}
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X size={14} aria-hidden />
      </button>
    </p>
  );
}

export function ProfilPanneau({ onFermer }: { onFermer: () => void }) {
  const { profil, token, expirer, actualiser } = useEspace();

  // Informations
  const [prenom, setPrenom] = useState(profil.prenom);
  const [nom, setNom] = useState(profil.nom);
  const [telephone, setTelephone] = useState(profil.telephone ?? "");
  const [envoiInfos, setEnvoiInfos] = useState(false);
  const [erreursInfos, setErreursInfos] = useState<Record<string, string[]>>({});
  const [noticeInfos, setNoticeInfos] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

  // Photo
  const [televersement, setTeleversement] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const champPhoto = useRef<HTMLInputElement>(null);

  // Mot de passe
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [envoiMdp, setEnvoiMdp] = useState(false);
  const [erreursMdp, setErreursMdp] = useState<Record<string, string[]>>({});
  const [noticeMdp, setNoticeMdp] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);

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

  // Retourne le message à afficher, ou null si la session a expiré (déjà gérée)
  const traiterErreur = useCallback(
    (e: unknown): string | null => {
      if (e instanceof ApiError && e.status === 401) {
        expirer();
        return null;
      }
      return messageErreur(e);
    },
    [expirer],
  );

  const infosModifiees =
    prenom.trim() !== profil.prenom || nom.trim() !== profil.nom || telephone.trim() !== (profil.telephone ?? "");

  async function enregistrerInfos(e: FormEvent) {
    e.preventDefault();
    if (envoiInfos || !infosModifiees) return;
    setErreursInfos({});
    setNoticeInfos(null);

    const locales: Record<string, string[]> = {};
    if (!prenom.trim()) locales.prenom = ["Le prénom est obligatoire."];
    if (!nom.trim()) locales.nom = ["Le nom est obligatoire."];
    if (Object.keys(locales).length > 0) {
      setErreursInfos(locales);
      return;
    }

    setEnvoiInfos(true);
    try {
      await api<Profil>("/me", {
        method: "PUT",
        token,
        body: JSON.stringify({ prenom: prenom.trim(), nom: nom.trim(), telephone: telephone.trim() || null }),
      });
      await actualiser();
      setNoticeInfos({ type: "ok", texte: "Votre profil est à jour." });
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErreursInfos(err.errors);
        return;
      }
      const texte = traiterErreur(err);
      if (texte) setNoticeInfos({ type: "erreur", texte });
    } finally {
      setEnvoiInfos(false);
    }
  }

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
      await api<Profil>("/me/photo", { method: "POST", token, body: donnees });
      await actualiser();
    } catch (err) {
      const texte = traiterErreur(err);
      if (texte) setErreurPhoto(err instanceof ApiError && err.errors?.photo?.[0] ? err.errors.photo[0] : texte);
    } finally {
      setTeleversement(false);
      if (champPhoto.current) champPhoto.current.value = "";
    }
  }

  async function changerMotDePasse(e: FormEvent) {
    e.preventDefault();
    if (envoiMdp) return;
    setErreursMdp({});
    setNoticeMdp(null);

    const locales: Record<string, string[]> = {};
    if (!actuel) locales.mot_de_passe_actuel = ["Saisissez votre mot de passe actuel."];
    if (nouveau.length < 10 || !/[A-Za-z]/.test(nouveau) || !/\d/.test(nouveau))
      locales.nouveau_mot_de_passe = ["Le nouveau mot de passe doit contenir au moins 10 caractères, avec des lettres et des chiffres."];
    else if (nouveau !== confirmation)
      locales.nouveau_mot_de_passe_confirmation = ["La confirmation ne correspond pas."];
    if (Object.keys(locales).length > 0) {
      setErreursMdp(locales);
      return;
    }

    setEnvoiMdp(true);
    try {
      await api<{ message: string }>("/me/mot-de-passe", {
        method: "PUT",
        token,
        body: JSON.stringify({
          mot_de_passe_actuel: actuel,
          nouveau_mot_de_passe: nouveau,
          nouveau_mot_de_passe_confirmation: confirmation,
        }),
      });
      setActuel("");
      setNouveau("");
      setConfirmation("");
      setNoticeMdp({
        type: "ok",
        texte: "Votre mot de passe a été modifié. Vos autres appareils devront se reconnecter.",
      });
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErreursMdp(err.errors);
        return;
      }
      const texte = traiterErreur(err);
      if (texte) setNoticeMdp({ type: "erreur", texte });
    } finally {
      setEnvoiMdp(false);
    }
  }

  const errI = (c: string) => erreursInfos[c]?.[0];
  const errM = (c: string) => erreursMdp[c]?.[0];

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-labelledby="titre-profil">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-site-line bg-site-surface shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-site-line px-5">
          <h2 id="titre-profil" className="font-display text-base font-semibold">
            Mon profil
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

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
          {/* Identité et photo */}
          <section className="space-y-4">
            <div className="flex items-center gap-4">
              <PastilleProfil profil={profil} taille="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold leading-tight">
                  {profil.prenom} {profil.nom}
                </p>
                {profil.poste && <p className="truncate text-sm text-site-muted">{profil.poste}</p>}
                <button
                  type="button"
                  onClick={() => champPhoto.current?.click()}
                  disabled={televersement}
                  className="mt-2 inline-flex h-9 items-center gap-2 rounded-full border border-site-line px-4 text-xs font-semibold transition-colors hover:border-brand-violet/60 disabled:opacity-60"
                >
                  {televersement ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <Camera size={14} aria-hidden />
                  )}
                  {profil.photo ? "Changer la photo" : "Ajouter une photo"}
                </button>
                <input
                  ref={champPhoto}
                  type="file"
                  accept={TYPES_PHOTO.join(",")}
                  className="sr-only"
                  aria-label="Choisir une photo de profil"
                  onChange={(e) => choisirPhoto(e.target.files?.[0])}
                />
              </div>
            </div>
            {erreurPhoto ? (
              <p className="text-xs text-site-danger">{erreurPhoto}</p>
            ) : (
              <p className="text-[11px] text-site-muted">
                JPG, PNG ou WebP, 2 Mo au maximum. Enregistrée dès que vous choisissez le fichier.
              </p>
            )}

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2.5 text-site-muted">
                <Mail size={15} aria-hidden className="shrink-0" />
                <span className="truncate text-site-ink">{profil.email}</span>
              </li>
              <li className="flex items-center gap-2.5 text-site-muted">
                <ShieldCheck size={15} aria-hidden className="shrink-0" />
                <span className="text-site-ink">{profil.role}</span>
              </li>
              {profil.entreprise && (
                <li className="flex items-center gap-2.5 text-site-muted">
                  <Building2 size={15} aria-hidden className="shrink-0" />
                  <span className="truncate text-site-ink">{profil.entreprise}</span>
                </li>
              )}
            </ul>
            <p className="text-[11px] text-site-muted">
              L’e-mail, le rôle et le poste sont gérés par vos administrateurs.
            </p>
          </section>

          {/* Informations personnelles */}
          <form onSubmit={enregistrerInfos} noValidate className="space-y-4">
            <h3 className="font-display text-sm font-semibold">Informations personnelles</h3>
            {noticeInfos && <Bandeau notice={noticeInfos} onFermer={() => setNoticeInfos(null)} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ id="pr-prenom" label="Prénom" requis erreur={errI("prenom")}>
                <input
                  id="pr-prenom"
                  className={CHAMP}
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  maxLength={60}
                  autoComplete="given-name"
                />
              </Champ>
              <Champ id="pr-nom" label="Nom" requis erreur={errI("nom")}>
                <input
                  id="pr-nom"
                  className={CHAMP}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  maxLength={50}
                  autoComplete="family-name"
                />
              </Champ>
            </div>
            <Champ id="pr-tel" label="Téléphone" erreur={errI("telephone")}>
              <input
                id="pr-tel"
                type="tel"
                className={CHAMP}
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                maxLength={20}
                autoComplete="tel"
              />
            </Champ>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!infosModifiees || envoiInfos}
                className="v-gradient-btn inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50"
              >
                {envoiInfos && <Loader2 size={16} className="animate-spin" aria-hidden />}
                Enregistrer
              </button>
            </div>
          </form>

          {/* Mot de passe */}
          <form onSubmit={changerMotDePasse} noValidate className="space-y-4 border-t border-site-line pt-6">
            <h3 className="font-display text-sm font-semibold">Changer le mot de passe</h3>
            {noticeMdp && <Bandeau notice={noticeMdp} onFermer={() => setNoticeMdp(null)} />}
            <Champ id="pr-actuel" label="Mot de passe actuel" requis erreur={errM("mot_de_passe_actuel")}>
              <input
                id="pr-actuel"
                type="password"
                className={CHAMP}
                value={actuel}
                onChange={(e) => setActuel(e.target.value)}
                autoComplete="current-password"
              />
            </Champ>
            <Champ
              id="pr-nouveau"
              label="Nouveau mot de passe"
              requis
              erreur={errM("nouveau_mot_de_passe")}
              aide="10 caractères minimum, avec des lettres et des chiffres."
            >
              <input
                id="pr-nouveau"
                type="password"
                className={CHAMP}
                value={nouveau}
                onChange={(e) => setNouveau(e.target.value)}
                maxLength={72}
                autoComplete="new-password"
              />
            </Champ>
            <Champ
              id="pr-confirmation"
              label="Confirmer le nouveau mot de passe"
              requis
              erreur={errM("nouveau_mot_de_passe_confirmation")}
            >
              <input
                id="pr-confirmation"
                type="password"
                className={CHAMP}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                maxLength={72}
                autoComplete="new-password"
              />
            </Champ>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={envoiMdp}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border border-site-line px-5 text-sm font-semibold transition-colors hover:border-brand-violet/60 disabled:opacity-60",
                )}
              >
                {envoiMdp && <Loader2 size={16} className="animate-spin" aria-hidden />}
                Changer le mot de passe
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

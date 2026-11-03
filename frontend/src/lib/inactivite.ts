/** Durée d'inactivité avant déconnexion automatique, alignée sur SANCTUM_INACTIVITE_MINUTES côté serveur. */
export const INACTIVITE_MINUTES = Number(process.env.NEXT_PUBLIC_INACTIVITE_MINUTES ?? 30);

/** Intervalle maximal entre deux signaux envoyés au serveur tant que l'utilisateur est actif. */
export const SIGNAL_ACTIVITE_MINUTES = 5;

const CLE_MESSAGE = "cms_inactivite";

export function marquerInactivite(): void {
  try {
    sessionStorage.setItem(CLE_MESSAGE, "1");
  } catch {
    // stockage indisponible : la page de connexion n'affichera pas le message
  }
}

export function consommerMessageInactivite(): boolean {
  try {
    const present = sessionStorage.getItem(CLE_MESSAGE) === "1";
    sessionStorage.removeItem(CLE_MESSAGE);
    return present;
  } catch {
    return false;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// Erreur renvoyée par l'API Laravel : { message, errors?: { champ: [messages] } }
export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

type ApiOptions = RequestInit & { token?: string | null };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...init } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Un FormData (envoi de fichier) fixe lui-même son Content-Type et sa frontière
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    let corps: { message?: string; errors?: Record<string, string[]> } | null = null;
    try {
      corps = await res.json();
    } catch {
      // réponse sans corps JSON : on garde le message par défaut
    }
    throw new ApiError(res.status, corps?.message ?? `Erreur API ${res.status}`, corps?.errors);
  }

  return res.json();
}

// Message lisible pour l'utilisateur à partir d'une erreur d'appel
export function messageErreur(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Trop de tentatives. Patientez une minute, puis réessayez.";
    if (err.status >= 500) return "Le serveur a rencontré un problème. Réessayez dans un instant.";
    return err.message;
  }
  return "Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.";
}

// Télécharge un fichier protégé : le serveur remet une adresse signée de courte durée, que le
// navigateur télécharge directement (le fichier arrive avec « Content-Disposition: attachment »,
// la page courante n'est donc pas quittée). Aucun appel inter-origines : pas de souci CORS.
export async function telechargerFichier(cheminLien: string, token: string): Promise<void> {
  const { url } = await api<{ url: string }>(cheminLien, { token });
  const lien = document.createElement("a");
  lien.href = url;
  lien.rel = "noopener";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
}

// Adresse publique d'un fichier du disque « public » de Laravel (photos de profil), à partir du
// chemin relatif renvoyé par l'API (ex. « photos/abc.jpg »). Le lien « storage » doit exister côté serveur.
export function urlStockage(chemin: string): string {
  if (/^https?:\/\//.test(chemin)) return chemin;
  return `${API_URL.replace(/\/api\/?$/, "")}/storage/${chemin.replace(/^\/+/, "")}`;
}

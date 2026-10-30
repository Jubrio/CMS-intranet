const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

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
      // réponse sans corps JSON 
    }
    throw new ApiError(res.status, corps?.message ?? `Erreur API ${res.status}`, corps?.errors);
  }

  return res.json();
}

export function messageErreur(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Trop de tentatives. Patientez une minute, puis réessayez.";
    if (err.status >= 500) return "Le serveur a rencontré un problème. Réessayez dans un instant.";
    return err.message;
  }
  return "Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.";
}

export async function telechargerFichier(cheminLien: string, token: string): Promise<void> {
  const { url } = await api<{ url: string }>(cheminLien, { token });
  const lien = document.createElement("a");
  lien.href = url;
  lien.rel = "noopener";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
}

export function urlStockage(chemin: string): string {
  if (/^https?:\/\//.test(chemin)) return chemin;
  return `${API_URL.replace(/\/api\/?$/, "")}/storage/${chemin.replace(/^\/+/, "")}`;
}

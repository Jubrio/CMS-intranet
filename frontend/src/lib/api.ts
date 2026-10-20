const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error(`Erreur API ${res.status}`);
  return res.json();
}
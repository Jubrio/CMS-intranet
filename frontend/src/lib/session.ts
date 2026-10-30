const TOKEN_KEY = "cms_token";

export function lireToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function enregistrerToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // stockage indisponible : la session ne survivra pas au rechargement
  }
}

export function effacerToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // rien à effacer
  }
}

import { authStorage } from "./auth-storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

/**
 * Fetch wrapper that attaches the access token and retries once after a silent refresh
 * on a 401. Auth endpoints themselves (login/refresh/invite-accept) should not go through
 * this — they're unauthenticated by definition.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  { skipAuth = false, isRetry = false }: { skipAuth?: boolean; isRetry?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (!skipAuth) {
    const accessToken = authStorage.getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      return apiFetch<T>(path, options, { skipAuth, isRetry: true });
    }
    authStorage.clear();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function tryRefreshTokens(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;

    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    authStorage.setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

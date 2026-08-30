import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api-client";
import { authStorage } from "./auth-storage";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("attaches the bearer token and returns parsed JSON on success", async () => {
    authStorage.setTokens("access-1", "refresh-1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>("/users/me");

    expect(result).toEqual({ ok: true });
    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("does not attach a token for skipAuth requests", async () => {
    authStorage.setTokens("access-1", "refresh-1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/auth/login", { method: "POST" }, { skipAuth: true });

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = new Headers(requestInit?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("retries once after a silent refresh on 401", async () => {
    authStorage.setTokens("expired-access", "refresh-1");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "new-access", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>("/users/me");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(authStorage.getAccessToken()).toBe("new-access");
    const [, retryInit] = fetchMock.mock.calls[2];
    expect(new Headers(retryInit?.headers).get("Authorization")).toBe("Bearer new-access");
  });

  it("clears tokens and throws when refresh also fails", async () => {
    authStorage.setTokens("expired-access", "expired-refresh");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ message: "Invalid refresh token" }, { status: 401 }));

    await expect(apiFetch("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(authStorage.getAccessToken()).toBeNull();
    expect(authStorage.getRefreshToken()).toBeNull();
  });

  it("throws an ApiError carrying the server's message on a non-401 failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Club not found" }, { status: 404 })
    );

    const error = await apiFetch("/clubs/missing").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("Club not found");
  });
});

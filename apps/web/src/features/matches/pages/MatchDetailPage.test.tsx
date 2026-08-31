import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchDetailPage } from "./MatchDetailPage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderMatchDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/matches/match-1"]}>
        <Routes>
          <Route path="/matches/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("MatchDetailPage — record a result", () => {
  let match: Record<string, unknown>;

  beforeEach(() => {
    vi.restoreAllMocks();
    match = {
      id: "match-1",
      tournamentId: "tourn-1",
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      scheduledAt: null,
      status: "SCHEDULED",
      endType: null,
      homeScore: null,
      awayScore: null,
      homeTeamFouls: 0,
      awayTeamFouls: 0,
    };
    authStorage.setTokens("test-access-token", "test-refresh-token");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/users/me")) {
        return jsonResponse({
          id: "user-1",
          email: "admin@test.local",
          firstName: "Super",
          lastName: "Admin",
          isSuperadmin: true,
          locale: "en",
          memberships: [],
        });
      }
      if (url.endsWith("/matches/match-1") && method === "GET") {
        return jsonResponse(match);
      }
      if (url.endsWith("/matches/match-1/result") && method === "PATCH") {
        const body = JSON.parse(init?.body as string);
        match = { ...match, ...body, status: "PLAYED" };
        return jsonResponse(match);
      }
      if (url.endsWith("/teams/team-home") && method === "GET") {
        return jsonResponse({ id: "team-home", clubId: "club-1", name: "Home Team", jerseyColor: null });
      }
      if (url.endsWith("/teams/team-away") && method === "GET") {
        return jsonResponse({ id: "team-away", clubId: "club-2", name: "Away Team", jerseyColor: null });
      }
      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });
  });

  it("submits a manual result and flips the match to PLAYED", async () => {
    renderMatchDetailPage();

    await screen.findByText("Home Team vs Away Team");
    expect(screen.getByText(/status: SCHEDULED|status: SCHEDULED/i)).toBeTruthy();

    const homeScoreInput = screen.getByLabelText(/home score|rezultat domaćih/i);
    const awayScoreInput = screen.getByLabelText(/away score|rezultat gostiju/i);
    await userEvent.clear(homeScoreInput);
    await userEvent.type(homeScoreInput, "21");
    await userEvent.clear(awayScoreInput);
    await userEvent.type(awayScoreInput, "18");

    await userEvent.click(screen.getByRole("button", { name: /save result|sačuvaj rezultat/i }));

    await waitFor(() => {
      expect(screen.getByText(/status: PLAYED/i)).toBeTruthy();
      expect(screen.getByText(/21 : 18/)).toBeTruthy();
    });
  });
});

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const currentUser = {
  id: "u1",
  email: "admin@example.com",
  firstName: "Super",
  lastName: "Admin",
  isSuperadmin: true,
  locale: "en",
  memberships: [],
};

const olderTournament = { id: "tourn-old", name: "Spring Cup", startDate: "2026-01-01", endDate: null, format: "ROUND_ROBIN", ageCategory: null, clubId: null };
const latestTournament = { id: "tourn-new", name: "Summer Cup", startDate: "2026-06-01", endDate: null, format: "ROUND_ROBIN", ageCategory: null, clubId: null };

const lockedMatch = {
  id: "match-locked",
  tournamentId: "tourn-new",
  homeTeamId: "team-home",
  awayTeamId: "team-away",
  phase: "GROUP_STAGE",
  scheduledAt: null,
  status: "SCHEDULED",
  endType: null,
  homeScore: null,
  awayScore: null,
  homeTeamFouls: 0,
  awayTeamFouls: 0,
  lockedAt: "2026-06-02T00:00:00.000Z",
};

const untouchedMatch = { ...lockedMatch, id: "match-untouched", lockedAt: null };

function renderHomePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournaments/:tournamentId" element={<p>tournament page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    authStorage.setTokens("access-token", "refresh-token");
    vi.restoreAllMocks();
  });

  it("shows the most recent tournament's matches, each with a lock-status badge", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(currentUser);
      if (url.endsWith("/tournaments")) return jsonResponse([olderTournament, latestTournament]);
      if (url.endsWith("/tournaments/tourn-new/matches")) return jsonResponse([lockedMatch, untouchedMatch]);
      if (url.endsWith("/teams/team-home")) return jsonResponse({ id: "team-home", clubId: "club-1", name: "Home Team", jerseyColor: null });
      if (url.endsWith("/teams/team-away")) return jsonResponse({ id: "team-away", clubId: "club-2", name: "Away Team", jerseyColor: null });
      if (url.endsWith("/matches/match-locked/tags")) return jsonResponse([{ id: "tag-1" }]);
      if (url.endsWith("/matches/match-untouched/tags")) return jsonResponse([]);
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    renderHomePage();

    // Picks Summer Cup (2026-06-01) over Spring Cup (2026-01-01) — the later start date.
    await screen.findByText("Summer Cup");
    expect(screen.queryByText("Spring Cup")).toBeNull();

    await screen.findByText(/locked/i);
    await screen.findByText(/not started/i);
  });

  it("shows an empty state when no tournaments exist yet", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/me")) return jsonResponse(currentUser);
      if (url.endsWith("/tournaments")) return jsonResponse([]);
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    renderHomePage();

    await screen.findByText(/no tournaments yet/i);
  });
});

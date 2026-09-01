import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TournamentDetailPage } from "./TournamentDetailPage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderTournamentDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tournaments/tourn-1"]}>
        <Routes>
          <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const TEAMS = [
  { id: "team-home", clubId: "club-1", name: "Home Team", jerseyColor: null },
  { id: "team-away", clubId: "club-1", name: "Away Team", jerseyColor: null },
];

describe("TournamentDetailPage — schedule a match", () => {
  let matches: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    matches = [];
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
      if (url.endsWith("/tournaments/tourn-1") && method === "GET") {
        return jsonResponse({
          id: "tourn-1",
          name: "Prolecni Kup",
          location: "Beograd",
          startDate: "2026-04-18",
          endDate: null,
          format: "GROUP_STAGE",
          ageCategory: "U18",
          clubId: "club-1",
        });
      }
      if (url.endsWith("/tournaments/tourn-1/matches") && method === "GET") {
        return jsonResponse(matches);
      }
      if (url.endsWith("/tournaments/tourn-1/matches") && method === "POST") {
        const created = {
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
        matches = [created];
        return jsonResponse(created);
      }
      if (url.endsWith("/clubs") && method === "GET") {
        return jsonResponse([{ id: "club-1", name: "KK Primer", city: null, logoUrl: null, contactEmail: null, contactPhone: null }]);
      }
      if (url.endsWith("/clubs/club-1/teams") && method === "GET") {
        return jsonResponse(TEAMS);
      }
      if (url.endsWith("/teams/team-home") && method === "GET") {
        return jsonResponse(TEAMS[0]);
      }
      if (url.endsWith("/teams/team-away") && method === "GET") {
        return jsonResponse(TEAMS[1]);
      }
      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });
  });

  it("schedules a match between a selected home and away team", async () => {
    renderTournamentDetailPage();

    await screen.findByText("Prolecni Kup");
    expect(screen.getByText(/no matches yet|nema utakmica/i)).toBeTruthy();

    const comboboxes = screen.getAllByRole("combobox");
    // Order in the DOM: home club, home team, away club, away team.
    const [homeClub, homeTeam, awayClub, awayTeam] = comboboxes;

    await userEvent.selectOptions(homeClub, "club-1");
    await screen.findByRole("option", { name: "Home Team" });
    await userEvent.selectOptions(homeTeam, "team-home");
    await userEvent.selectOptions(awayClub, "club-1");
    await userEvent.selectOptions(awayTeam, "team-away");

    await userEvent.click(screen.getByRole("button", { name: /schedule match|zakaži utakmicu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Home Team.*vs.*Away Team.*SCHEDULED/i)).toBeTruthy();
    });

    // The roster-builder deep links resolve each participating team via useTeam.
    await waitFor(() => {
      expect(screen.getByText(/Home Team — (manage roster|upravljaj sastavom)/i)).toBeTruthy();
      expect(screen.getByText(/Away Team — (manage roster|upravljaj sastavom)/i)).toBeTruthy();
    });
  });
});

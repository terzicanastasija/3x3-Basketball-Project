import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamDetailPage } from "./TeamDetailPage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderTeamDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/clubs/club-1/teams/team-1"]}>
        <Routes>
          <Route path="/clubs/:clubId/teams/:teamId" element={<TeamDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TeamDetailPage roster builder", () => {
  let rosterExists: boolean;
  let rosterPlayers: Array<{ id: string; playerId: string; jerseyNumber: null; player: { id: string; firstName: string; lastName: string } }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    rosterExists = false;
    rosterPlayers = [];
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
          isScout: false,
          locale: "en",
          memberships: [],
        });
      }
      if (url.endsWith("/teams/team-1")) {
        return jsonResponse({ id: "team-1", clubId: "club-1", name: "U18 Boys", jerseyColor: null });
      }
      if (url.endsWith("/tournaments")) {
        return jsonResponse([{ id: "t1", name: "Prolecni Kup", startDate: "2026-04-18", endDate: null }]);
      }
      if (url.includes("/players?")) {
        return jsonResponse([
          {
            id: "p1",
            firstName: "Marko",
            lastName: "Markovic",
            dateOfBirth: null,
            heightCm: null,
            dominantHand: "UNKNOWN",
            photoUrl: null,
            homeClubId: "club-1",
            position: null,
            homeClub: null,
          },
        ]);
      }
      if (url.endsWith("/teams/team-1/rosters/t1/players/p1") && method === "DELETE") {
        rosterPlayers = [];
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/teams/team-1/rosters/t1/players") && method === "POST") {
        rosterPlayers = [
          { id: "rp1", playerId: "p1", jerseyNumber: null, player: { id: "p1", firstName: "Marko", lastName: "Markovic" } },
        ];
        return jsonResponse(rosterPlayers[0]);
      }
      if (url.endsWith("/teams/team-1/rosters/t1") && method === "GET") {
        if (!rosterExists) return jsonResponse({ message: "Not found" }, { status: 404 });
        return jsonResponse({ id: "roster-1", teamId: "team-1", tournamentId: "t1", players: rosterPlayers });
      }
      if (url.endsWith("/teams/team-1/rosters") && method === "POST") {
        rosterExists = true;
        return jsonResponse({ id: "roster-1", teamId: "team-1", tournamentId: "t1", players: [] });
      }
      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });
  });

  it("creates a roster, adds a player, and removes a player", async () => {
    renderTeamDetailPage();

    await screen.findByText("U18 Boys");

    await userEvent.selectOptions(screen.getByRole("combobox"), "t1");

    await screen.findByText(/no roster yet|sastav za ovaj turnir/i);
    await userEvent.click(screen.getByRole("button", { name: /create roster|napravi sastav/i }));

    await screen.findByText(/roster is empty|sastav je prazan/i);
    const addSection = screen.getByText(/add a player|dodaj igrača/i).closest("div") ?? document.body;
    await userEvent.click(within(addSection).getByRole("button", { name: /^add$|^dodaj$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Marko Markovic/)).toBeTruthy();
      expect(screen.queryByText(/roster is empty|sastav je prazan/i)).toBeNull();
    });

    await userEvent.click(screen.getByRole("button", { name: /remove|ukloni/i }));

    await waitFor(() => {
      expect(screen.getByText(/roster is empty|sastav je prazan/i)).toBeTruthy();
    });
  });
});

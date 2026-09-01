import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SelectMatchToTagPage } from "./SelectMatchToTagPage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function TaggingRouteProbe() {
  const { matchId } = useParams<{ matchId: string }>();
  return <p>tagging screen for match {matchId}</p>;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tag"]}>
        <Routes>
          <Route path="/tag" element={<SelectMatchToTagPage />} />
          <Route
            path="/matches/:matchId/tag"
            element={<TaggingRouteProbe />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SelectMatchToTagPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authStorage.setTokens("test-access-token", "test-refresh-token");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/me")) {
        return jsonResponse({
          id: "user-1",
          email: "scout@test.local",
          firstName: "Nikola",
          lastName: "Scout",
          isSuperadmin: false,
          isScout: true,
          locale: "en",
          memberships: [],
        });
      }
      if (url.endsWith("/tournaments")) {
        return jsonResponse([{ id: "tourn-1", name: "Regionalni Kup", startDate: "2026-05-16", endDate: null }]);
      }
      if (url.endsWith("/tournaments/tourn-1/matches")) {
        return jsonResponse([
          {
            id: "match-1",
            tournamentId: "tourn-1",
            homeTeamId: "team-home",
            awayTeamId: "team-away",
            phase: "SEMIFINAL",
            scheduledAt: null,
            status: "SCHEDULED",
            endType: null,
            homeScore: null,
            awayScore: null,
            homeTeamFouls: 0,
            awayTeamFouls: 0,
          },
        ]);
      }
      if (url.endsWith("/teams/team-home")) {
        return jsonResponse({ id: "team-home", clubId: "club-1", name: "Home Team", jerseyColor: null });
      }
      if (url.endsWith("/teams/team-away")) {
        return jsonResponse({ id: "team-away", clubId: "club-2", name: "Away Team", jerseyColor: null });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });
  });

  it("selecting a tournament then a match navigates to that match's tagging screen", async () => {
    renderPage();

    const tournamentSelect = await screen.findByLabelText(/tournament|turnir/i);
    await screen.findByRole("option", { name: "Regionalni Kup" });
    await userEvent.selectOptions(tournamentSelect, "tourn-1");

    const matchSelect = await screen.findByLabelText(/^match$|^utakmica$/i);
    await screen.findByRole("option", { name: /Home Team.*Away Team/i });
    await userEvent.selectOptions(matchSelect, "match-1");

    await screen.findByText("tagging screen for match match-1");
  });
});

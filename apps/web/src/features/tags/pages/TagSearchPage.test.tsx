import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagSearchPage } from "./TagSearchPage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const tournament = { id: "tourn-1", name: "Regional Cup", startDate: "2026-01-01", endDate: null, format: "ROUND_ROBIN", ageCategory: null, clubId: null };
const player = { id: "player-1", firstName: "Marko", lastName: "Markovic", dateOfBirth: null, heightCm: null, dominantHand: "RIGHT", photoUrl: null, homeClubId: "club-1", position: null, homeClub: { id: "club-1", name: "KK Dunav", city: "Beograd" } };

const searchResult = {
  id: "tag-1",
  matchId: "match-1",
  videoAssetId: "video-1",
  timestampSec: 12.5,
  actionType: "OFFENSIVE_REBOUND",
  teamId: "team-home",
  playerId: "player-1",
  relatedPlayerId: null,
  defenderId: null,
  pointValue: null,
  isMade: null,
  clipInSec: null,
  clipOutSec: null,
  reviewedAt: null,
  reviewedById: null,
  player: { id: "player-1", firstName: "Marko", lastName: "Markovic" },
  relatedPlayer: null,
  defender: null,
  reviewedBy: null,
  match: {
    id: "match-1",
    tournamentId: "tourn-1",
    phase: "GROUP_STAGE",
    homeTeam: { id: "team-home", name: "Dunav Seniori" },
    awayTeam: { id: "team-away", name: "Sava Seniori" },
    tournament: { id: "tourn-1", name: "Regional Cup" },
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/search"]}>
        <Routes>
          <Route path="/search" element={<TagSearchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TagSearchPage", () => {
  beforeEach(() => {
    authStorage.setTokens("test-access-token", "test-refresh-token");
    vi.restoreAllMocks();
  });

  it("loads results with no filters, then re-fetches with the chosen tournament filter applied", async () => {
    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.endsWith("/tournaments")) return jsonResponse([tournament]);
      if (url.endsWith("/players")) return jsonResponse([player]);
      if (url.includes("/tags")) return jsonResponse([searchResult]);
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    renderPage();

    const resultsList = await screen.findByRole("list");
    const resultLink = (await within(resultsList).findByRole("link", { name: /Regional Cup/ })) as HTMLAnchorElement;
    expect(resultLink.getAttribute("href")).toBe("/matches/match-1/tag");
    expect(within(resultsList).getByText(/Marko Markovic/)).toBeTruthy();

    const tournamentSelect = screen.getByDisplayValue(/all tournaments|svi turniri/i);
    await userEvent.selectOptions(tournamentSelect, "tourn-1");

    await screen.findByRole("link", { name: /Regional Cup/ });
    expect(requestedUrls.some((u) => u.includes("tournamentId=tourn-1"))).toBe(true);
  });

  it("shows the empty state when no tags match", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/tournaments")) return jsonResponse([]);
      if (url.endsWith("/players")) return jsonResponse([]);
      if (url.includes("/tags")) return jsonResponse([]);
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    renderPage();

    await screen.findByText(/no tags match|nijedna oznaka/i);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaggingPage } from "./TaggingPage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

const match = {
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
  lockedAt: null,
};

const roster = {
  id: "roster-1",
  teamId: "team-home",
  tournamentId: "tourn-1",
  players: [{ id: "rp-1", playerId: "player-1", jerseyNumber: 7, player: { id: "player-1", firstName: "Marko", lastName: "Markovic" } }],
};

function renderTaggingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/matches/match-1/tag"]}>
        <Routes>
          <Route path="/matches/:matchId/tag" element={<TaggingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockCommonFetch(video: Record<string, unknown>, createdTags: Record<string, unknown>[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/matches/match-1") && method === "GET") return jsonResponse(match);
    if (url.endsWith("/teams/team-home") && method === "GET")
      return jsonResponse({ id: "team-home", clubId: "club-1", name: "Home Team", jerseyColor: null });
    if (url.endsWith("/teams/team-away") && method === "GET")
      return jsonResponse({ id: "team-away", clubId: "club-2", name: "Away Team", jerseyColor: null });
    if (url.endsWith("/teams/team-home/rosters/tourn-1") && method === "GET") return jsonResponse(roster);
    if (url.endsWith("/teams/team-away/rosters/tourn-1") && method === "GET")
      return jsonResponse({ ...roster, teamId: "team-away", players: [] });
    if (url.endsWith("/matches/match-1/videos") && method === "GET") return jsonResponse([video]);
    if (url.includes("/playback-url") && method === "GET") {
      // Mirrors the real backend (VideoService.getPlaybackUrl): FILE gets a signed stream URL,
      // EXTERNAL gets its actual externalUrl back untouched (no signing needed for YouTube).
      const playbackUrl =
        video.sourceType === "EXTERNAL" ? (video.externalUrl as string) : "https://example.local/stream";
      return jsonResponse({ url: playbackUrl, sourceType: video.sourceType });
    }
    if (url.endsWith("/matches/match-1/tags") && method === "GET") return jsonResponse(createdTags);
    if (url.endsWith("/matches/match-1/tags") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      const created = { id: `tag-${createdTags.length + 1}`, matchId: "match-1", ...body };
      createdTags.push(created);
      return jsonResponse(created, { status: 201 });
    }
    throw new Error(`Unhandled fetch in test: ${method} ${url}`);
  });
}

describe("TaggingPage — VideoPlayerAdapter parity", () => {
  beforeEach(() => {
    authStorage.setTokens("test-access-token", "test-refresh-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as { YT?: unknown }).YT;
  });

  it("captures the adapter's current time when tagging against a FILE video", async () => {
    const createdTags: Record<string, unknown>[] = [];
    mockCommonFetch({ id: "video-1", sourceType: "FILE", fileKey: "matches/match-1/x.mp4" }, createdTags);
    renderTaggingPage();

    const video = (await screen.findByTestId("video-player-file")) as HTMLVideoElement;
    video.currentTime = 42.5;
    video.dispatchEvent(new Event("loadedmetadata"));

    const assistButton = (await screen.findByRole("button", {
      name: /assist|asistencija/i,
    })) as HTMLButtonElement;
    await waitFor(() => expect(assistButton.disabled).toBe(false));
    await userEvent.click(assistButton);

    await waitFor(() => expect(createdTags).toHaveLength(1));
    expect(createdTags[0]).toMatchObject({ actionType: "ASSIST", timestampSec: 42.5, teamId: "team-home" });
  });

  it("captures the adapter's current time when tagging against a YouTube video", async () => {
    class FakeYTPlayer {
      currentTime = 17.25;
      constructor(
        _container: HTMLElement,
        private options: { events?: { onReady?: (e: { target: FakeYTPlayer }) => void } }
      ) {
        queueMicrotask(() => this.options.events?.onReady?.({ target: this }));
      }
      getCurrentTime() {
        return this.currentTime;
      }
      seekTo(seconds: number) {
        this.currentTime = seconds;
      }
      playVideo() {}
      pauseVideo() {}
      setPlaybackRate() {}
      getDuration() {
        return 600;
      }
      destroy() {}
    }
    (window as unknown as { YT: unknown }).YT = { Player: FakeYTPlayer };

    const createdTags: Record<string, unknown>[] = [];
    mockCommonFetch(
      { id: "video-1", sourceType: "EXTERNAL", externalUrl: "https://www.youtube.com/watch?v=abc123" },
      createdTags
    );
    renderTaggingPage();

    await screen.findByTestId("video-player-youtube");

    const assistButton = (await screen.findByRole("button", {
      name: /assist|asistencija/i,
    })) as HTMLButtonElement;
    await waitFor(() => expect(assistButton.disabled).toBe(false));
    await userEvent.click(assistButton);

    await waitFor(() => expect(createdTags).toHaveLength(1));
    expect(createdTags[0]).toMatchObject({ actionType: "ASSIST", timestampSec: 17.25, teamId: "team-home" });
  });
});

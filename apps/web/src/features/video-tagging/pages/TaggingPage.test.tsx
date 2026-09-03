import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          <Route path="/compilations/:id" element={<p>compilation page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const scoutCurrentUser = {
  id: "user-1",
  email: "scout@test.local",
  firstName: "Nikola",
  lastName: "Scout",
  isSuperadmin: false,
  isScout: true,
  locale: "en",
  memberships: [],
};

const coachCurrentUser = {
  id: "user-2",
  email: "coach@test.local",
  firstName: "Some",
  lastName: "Coach",
  isSuperadmin: false,
  isScout: false,
  locale: "en",
  memberships: [],
};

const adminCurrentUser = {
  id: "user-3",
  email: "admin@test.local",
  firstName: "Super",
  lastName: "Admin",
  isSuperadmin: true,
  isScout: false,
  locale: "en",
  memberships: [],
};

function mockCommonFetch(
  video: Record<string, unknown>,
  createdTags: Record<string, unknown>[],
  currentUser: Record<string, unknown> = scoutCurrentUser
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/users/me") && method === "GET") return jsonResponse(currentUser);
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
    if (url.match(/\/tags\/tag-\d+\/clip$/) && method === "GET") {
      // Video source determines CLIP vs DEEP_LINK — mirrors ClipsService.resolveTagClip.
      return jsonResponse(
        video.sourceType === "EXTERNAL"
          ? { type: "DEEP_LINK", url: "https://www.youtube.com/watch?v=abc123&t=17s" }
          : { type: "CLIP", status: "COMPLETED", url: "https://example.local/clip.mp4" }
      );
    }
    if (url.endsWith("/compilations") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      return jsonResponse({ id: "compilation-1", createdById: "user-1", createdAt: "", ...body }, { status: 201 });
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

  it("uses a manual [ / ] in-out mark as the clip window instead of the auto padding", async () => {
    const createdTags: Record<string, unknown>[] = [];
    mockCommonFetch({ id: "video-1", sourceType: "FILE", fileKey: "matches/match-1/x.mp4" }, createdTags);
    renderTaggingPage();

    const video = (await screen.findByTestId("video-player-file")) as HTMLVideoElement;
    video.currentTime = 10;
    video.dispatchEvent(new Event("loadedmetadata"));

    // userEvent.keyboard() treats "[" as key-descriptor syntax, not a literal keypress — dispatch
    // the raw keydown directly instead, same as the app's window-level listener actually receives.
    video.currentTime = 8;
    fireEvent.keyDown(window, { key: "[" });
    video.currentTime = 14;
    fireEvent.keyDown(window, { key: "]" });

    const assistButton = (await screen.findByRole("button", {
      name: /assist|asistencija/i,
    })) as HTMLButtonElement;
    await waitFor(() => expect(assistButton.disabled).toBe(false));
    await userEvent.click(assistButton);

    await waitFor(() => expect(createdTags).toHaveLength(1));
    expect(createdTags[0]).toMatchObject({ actionType: "ASSIST", clipInSec: 8, clipOutSec: 14 });
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

describe("TaggingPage — compilation builder", () => {
  beforeEach(() => {
    authStorage.setTokens("test-access-token", "test-refresh-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects a tag, submits a title, and navigates to the new compilation", async () => {
    const createdTags: Record<string, unknown>[] = [
      { id: "tag-1", matchId: "match-1", timestampSec: 5, actionType: "STEAL", teamId: "team-home", pointValue: null },
    ];
    let compilationRequestBody: Record<string, unknown> | undefined;
    mockCommonFetch({ id: "video-1", sourceType: "FILE", fileKey: "matches/match-1/x.mp4" }, createdTags);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/compilations") && init?.method === "POST") {
        compilationRequestBody = JSON.parse(init.body as string);
      }
      return originalFetch(input, init);
    });
    renderTaggingPage();

    const checkbox = await screen.findByRole("checkbox");
    await userEvent.click(checkbox);

    const titleInput = await screen.findByLabelText(/compilation title|naziv kompilacije/i);
    await userEvent.type(titleInput, "Best steals");

    const buildButton = await screen.findByRole("button", { name: /build compilation|napravi kompilaciju/i });
    await userEvent.click(buildButton);

    await waitFor(() => expect(screen.getByText("compilation page")).toBeTruthy());
    expect(compilationRequestBody).toEqual({ title: "Best steals", actionTagIds: ["tag-1"] });
  });
});

describe("TaggingPage — RBAC (Scout/Admin can tag, Coach is read-only)", () => {
  beforeEach(() => {
    authStorage.setTokens("test-access-token", "test-refresh-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides the video registration panel, action grid, and lock button for a Coach", async () => {
    const createdTags: Record<string, unknown>[] = [
      { id: "tag-1", matchId: "match-1", timestampSec: 5, actionType: "STEAL", teamId: "team-home", pointValue: null },
    ];
    mockCommonFetch(
      { id: "video-1", sourceType: "FILE", fileKey: "matches/match-1/x.mp4" },
      createdTags,
      coachCurrentUser
    );
    renderTaggingPage();

    // The read-only view a Coach gets: the tag list is visible (with the clip badge)...
    await screen.findByText(/steal|kradja/i);
    // ...but no action-type buttons, no lock button, and no edit/delete controls exist at all.
    expect(screen.queryByRole("button", { name: /assist|asistencija/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /lock match|zaključaj utakmicu/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^edit$|^izmeni$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^delete$|^obriši$/i })).toBeNull();
  });

  it("shows a 'no video yet' message instead of the registration panel for a Coach when no video is registered", async () => {
    mockCommonFetch({ id: "video-1", sourceType: "FILE", fileKey: "x.mp4" }, [], coachCurrentUser);
    // Override so no video is registered yet for this match.
    const base = globalThis.fetch as unknown as (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => Promise<Response>;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/matches/match-1/videos") && (init?.method ?? "GET") === "GET") return jsonResponse([]);
      return base(input, init);
    });
    renderTaggingPage();

    await screen.findByText(/no video registered|nije registrovan video/i);
    expect(screen.queryByLabelText(/youtube/i)).toBeNull();
  });

  it("still lets an Admin tag and delete on a locked match — the lock only finalizes the Scout's work", async () => {
    const createdTags: Record<string, unknown>[] = [
      { id: "tag-1", matchId: "match-1", timestampSec: 5, actionType: "STEAL", teamId: "team-home", pointValue: null },
    ];
    mockCommonFetch(
      { id: "video-1", sourceType: "FILE", fileKey: "matches/match-1/x.mp4" },
      createdTags,
      adminCurrentUser
    );
    const base = globalThis.fetch as unknown as (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => Promise<Response>;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/matches/match-1") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ ...match, lockedAt: "2026-09-01T00:00:00.000Z" });
      }
      return base(input, init);
    });
    renderTaggingPage();

    const video = (await screen.findByTestId("video-player-file")) as HTMLVideoElement;
    video.currentTime = 42.5;
    video.dispatchEvent(new Event("loadedmetadata"));

    const assistButton = (await screen.findByRole("button", {
      name: /assist|asistencija/i,
    })) as HTMLButtonElement;
    await waitFor(() => expect(assistButton.disabled).toBe(false));

    const deleteButton = await screen.findByRole("button", { name: /^delete$|^obriši$/i });
    expect(deleteButton).toBeTruthy();
  });
});

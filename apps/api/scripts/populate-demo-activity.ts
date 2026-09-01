/**
 * Populates existing scheduled matches with a real YouTube video + a realistic randomized set
 * of tagged actions, then locks each match so stats actually compute — for demo/testing data,
 * not a fixture asserted against in any test. Run against the real running API (not Prisma
 * directly) so the exact same code path a Scout would use — RBAC, server-derived pointValue,
 * clip-generation branching, the stat-recompute queue — runs for real. Safe to re-run: any match
 * that already has a tag or is locked is left completely untouched (never overwrites real
 * work, e.g. manual testing you've already done).
 *
 * Usage: pnpm --filter api seed:demo-activity
 * Requires: the API dev server running on API_BASE_URL, and prisma db seed already run (so the
 * scout login and the match/roster IDs below exist).
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const SCOUT_EMAIL = "nikola.scout@3x3app.local";
const SCOUT_PASSWORD = "NikolaScout123!";

// Real full-game broadcasts from FIBA 3x3's official YouTube channel (@FIBA3x3) — found via web
// search, not guessed. Registered as EXTERNAL video sources (a real YouTube link, exactly what
// the app's own "Add YouTube link" feature does) — no downloading, just linking.
const MATCH_VIDEOS: Record<string, string> = {
  "match-morava-vs-drina": "https://www.youtube.com/watch?v=R76pJRbHbRQ", // Madagascar vs Serbia, Pool Game, FIBA 3x3 World Cup 2026
  "match-dunav-vs-morava": "https://www.youtube.com/watch?v=_5kii069EU8", // Lithuania vs France, Pool Game, FIBA 3x3 World Cup 2026
  "match-sava-vs-drina": "https://www.youtube.com/watch?v=_jSZxW6Ud-M", // Chinese Taipei vs Philippines, FIBA 3x3 Asia Cup 2026
  "match-dunav-vs-drina": "https://www.youtube.com/watch?v=z24YM8uJmSw", // Philippines vs Maldives, FIBA 3x3 Asia Cup 2026
  "match-sava-vs-morava": "https://www.youtube.com/watch?v=FYEffLSdA3Q", // Serbia vs Netherlands, Quarter-Finals, FIBA 3x3 World Cup 2026
  // match-dunav-vs-sava is deliberately excluded — already has real user-created tags/lock.
};

const ACTION_WEIGHTS: Array<[string, number]> = [
  ["SHOT_2PT_MADE", 3],
  ["SHOT_2PT_MISSED", 3],
  ["SHOT_1PT_MADE", 4],
  ["SHOT_1PT_MISSED", 3],
  ["FREE_THROW_MADE", 2],
  ["FREE_THROW_MISSED", 1],
  ["OFFENSIVE_REBOUND", 2],
  ["DEFENSIVE_REBOUND", 3],
  ["ASSIST", 2],
  ["TURNOVER", 2],
  ["STEAL", 2],
  ["BLOCK", 1],
  ["PERSONAL_FOUL", 2],
];
const ACTION_POOL = ACTION_WEIGHTS.flatMap(([type, weight]) => Array(weight).fill(type));

const GAME_LENGTH_SEC = 600; // nominal 10-minute 3x3 clock
const TAGS_PER_MATCH = 24;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function api<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface RosterPlayer {
  playerId: string;
}
interface Roster {
  players: RosterPlayer[];
}

async function main() {
  const { accessToken } = await api<{ accessToken: string }>(null, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: SCOUT_EMAIL, password: SCOUT_PASSWORD }),
  });
  console.log(`Logged in as ${SCOUT_EMAIL}`);

  for (const [matchId, youtubeUrl] of Object.entries(MATCH_VIDEOS)) {
    const match = await api<{
      id: string;
      tournamentId: string;
      homeTeamId: string;
      awayTeamId: string;
      lockedAt: string | null;
    }>(accessToken, `/matches/${matchId}`);

    const existingTags = await api<unknown[]>(accessToken, `/matches/${matchId}/tags`);
    if (match.lockedAt || existingTags.length > 0) {
      console.log(`Skipping ${matchId} — already has real activity (locked or has tags).`);
      continue;
    }

    const [homeRoster, awayRoster] = await Promise.all([
      api<Roster>(accessToken, `/teams/${match.homeTeamId}/rosters/${match.tournamentId}`),
      api<Roster>(accessToken, `/teams/${match.awayTeamId}/rosters/${match.tournamentId}`),
    ]);

    const video = await api<{ id: string }>(accessToken, `/matches/${matchId}/videos`, {
      method: "POST",
      body: JSON.stringify({ sourceType: "EXTERNAL", externalUrl: youtubeUrl }),
    });
    console.log(`${matchId}: registered YouTube video ${youtubeUrl}`);

    const timestamps = Array.from({ length: TAGS_PER_MATCH }, () => Math.random() * GAME_LENGTH_SEC).sort(
      (a, b) => a - b
    );

    for (const timestampSec of timestamps) {
      const isHome = Math.random() < 0.5;
      const teamId = isHome ? match.homeTeamId : match.awayTeamId;
      const sameTeamRoster = isHome ? homeRoster.players : awayRoster.players;
      const otherTeamRoster = isHome ? awayRoster.players : homeRoster.players;
      if (sameTeamRoster.length === 0) continue;

      const actionType = pick(ACTION_POOL);
      const playerId = pick(sameTeamRoster).playerId;
      const isMade = actionType.endsWith("_MADE") ? true : actionType.endsWith("_MISSED") ? false : undefined;

      let relatedPlayerId: string | undefined;
      if (actionType === "ASSIST") {
        const teammates = sameTeamRoster.filter((p) => p.playerId !== playerId);
        if (teammates.length > 0) relatedPlayerId = pick(teammates).playerId;
      } else if ((actionType === "STEAL" || actionType === "BLOCK") && otherTeamRoster.length > 0) {
        relatedPlayerId = pick(otherTeamRoster).playerId;
      }

      await api(accessToken, `/matches/${matchId}/tags`, {
        method: "POST",
        body: JSON.stringify({
          videoAssetId: video.id,
          timestampSec: Number(timestampSec.toFixed(1)),
          actionType,
          teamId,
          playerId,
          relatedPlayerId,
          isMade,
        }),
      });
    }
    console.log(`${matchId}: created ${timestamps.length} tags`);

    await api(accessToken, `/matches/${matchId}/lock`, { method: "POST" });
    console.log(`${matchId}: locked — stat recompute enqueued`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

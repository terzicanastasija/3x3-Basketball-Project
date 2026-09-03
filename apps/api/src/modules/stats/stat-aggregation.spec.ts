import { ActionType } from "@3x3/shared";
import { aggregateMatchTags, computeTeamPossessions, sumStatLines } from "./stat-aggregation";

describe("aggregateMatchTags", () => {
  it("computes exact stat lines from a small hand-counted fixture", () => {
    // Team A: player-1 scores a 2pt (made), misses a 2pt, gets an assist. Player-2 gets an
    // offensive rebound. Team B: player-3 makes a free throw, commits a foul.
    const { players, teams } = aggregateMatchTags(
      [
        { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.SHOT_2PT_MISSED, teamId: "team-a", playerId: "player-1", timestampSec: 2 },
        { actionType: ActionType.ASSIST, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.OFFENSIVE_REBOUND, teamId: "team-a", playerId: "player-2", timestampSec: 3 },
        { actionType: ActionType.FREE_THROW_MADE, teamId: "team-b", playerId: "player-3", timestampSec: 4 },
        { actionType: ActionType.PERSONAL_FOUL, teamId: "team-b", playerId: "player-3", timestampSec: 4 },
      ],
      "team-a",
      "team-b"
    );

    expect(players.get("player-1")).toMatchObject({
      gamesPlayed: 1,
      points: 2,
      shots2ptMade: 1,
      shots2ptAtt: 2,
      assists: 1,
    });
    expect(players.get("player-2")).toMatchObject({ gamesPlayed: 1, offRebounds: 1, points: 0 });
    expect(players.get("player-3")).toMatchObject({
      gamesPlayed: 1,
      points: 1,
      ftMade: 1,
      ftAtt: 1,
      personalFouls: 1,
    });

    expect(teams.get("team-a")).toMatchObject({
      points: 2,
      shots2ptMade: 1,
      shots2ptAtt: 2,
      assists: 1,
      offRebounds: 1,
    });
    expect(teams.get("team-b")).toMatchObject({ points: 1, ftMade: 1, ftAtt: 1, personalFouls: 1 });
  });

  it("never derives points for a non-shot action type", () => {
    const { players } = aggregateMatchTags(
      [
        { actionType: ActionType.STEAL, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.TURNOVER, teamId: "team-a", playerId: "player-1", timestampSec: 2 },
        { actionType: ActionType.BLOCK, teamId: "team-a", playerId: "player-1", timestampSec: 3 },
        { actionType: ActionType.DEFENSIVE_REBOUND, teamId: "team-a", playerId: "player-1", timestampSec: 4 },
      ],
      "team-a",
      "team-b"
    );
    expect(players.get("player-1")?.points).toBe(0);
  });

  it("credits a team-only action (no playerId) to the team but not to any player", () => {
    const { players, teams } = aggregateMatchTags(
      [{ actionType: ActionType.TURNOVER, teamId: "team-a", playerId: null, timestampSec: 1 }],
      "team-a",
      "team-b"
    );
    expect(teams.get("team-a")).toMatchObject({ turnovers: 1 });
    expect(players.size).toBe(0);
  });

  it("gamesPlayed is 1 per touched player/team regardless of tag count", () => {
    const { players, teams } = aggregateMatchTags(
      [
        { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 2 },
        { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 3 },
      ],
      "team-a",
      "team-b"
    );
    expect(players.get("player-1")?.gamesPlayed).toBe(1);
    expect(teams.get("team-a")?.gamesPlayed).toBe(1);
  });

  it("credits possessions onto the team lines (never a player line)", () => {
    const { players, teams } = aggregateMatchTags(
      [{ actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 1 }],
      "team-a",
      "team-b"
    );
    expect(teams.get("team-a")?.possessions).toBe(1);
    expect(players.get("player-1")?.possessions).toBe(0);
  });
});

describe("computeTeamPossessions", () => {
  it("credits a made shot as one possession for the scoring team", () => {
    const possessions = computeTeamPossessions(
      [{ actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 1 }],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(1);
    expect(possessions.get("team-b")).toBe(0);
  });

  it("does NOT end the possession when a miss is followed by the same team's own offensive rebound", () => {
    const possessions = computeTeamPossessions(
      [
        { actionType: ActionType.SHOT_2PT_MISSED, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.OFFENSIVE_REBOUND, teamId: "team-a", playerId: "player-2", timestampSec: 2 },
        { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 3 },
      ],
      "team-a",
      "team-b"
    );
    // One real possession (miss -> offensive rebound -> make), not two.
    expect(possessions.get("team-a")).toBe(1);
  });

  it("ends the shooting team's possession when the OTHER team gets the defensive rebound", () => {
    const possessions = computeTeamPossessions(
      [
        { actionType: ActionType.SHOT_2PT_MISSED, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.DEFENSIVE_REBOUND, teamId: "team-b", playerId: "player-3", timestampSec: 2 },
      ],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(1);
    expect(possessions.get("team-b")).toBe(0);
  });

  it("credits a turnover as a possession-ending for the team that lost the ball", () => {
    const possessions = computeTeamPossessions(
      [{ actionType: ActionType.TURNOVER, teamId: "team-a", playerId: "player-1", timestampSec: 1 }],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(1);
  });

  it("credits a steal as a possession-ending for the OTHER team (whoever got stolen from), not the stealing team", () => {
    const possessions = computeTeamPossessions(
      [{ actionType: ActionType.STEAL, teamId: "team-a", playerId: "player-1", timestampSec: 1 }],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(0);
    expect(possessions.get("team-b")).toBe(1);
  });

  it("processes tags in chronological order regardless of input array order", () => {
    // Miss at t=5, rebound at t=2 in the array — must still resolve as rebound-after-miss.
    const possessions = computeTeamPossessions(
      [
        { actionType: ActionType.DEFENSIVE_REBOUND, teamId: "team-b", playerId: "player-3", timestampSec: 2 },
        { actionType: ActionType.SHOT_2PT_MISSED, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
      ],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(1);
  });

  it("a full back-and-forth sequence tallies both teams correctly", () => {
    const possessions = computeTeamPossessions(
      [
        { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1", timestampSec: 1 }, // a's 1st ends: made
        { actionType: ActionType.SHOT_2PT_MISSED, teamId: "team-b", playerId: "player-3", timestampSec: 2 },
        { actionType: ActionType.DEFENSIVE_REBOUND, teamId: "team-a", playerId: "player-2", timestampSec: 3 }, // b's 1st ends: def. rebound by a
        { actionType: ActionType.TURNOVER, teamId: "team-a", playerId: "player-1", timestampSec: 4 }, // a's 2nd ends: turnover
        { actionType: ActionType.SHOT_1PT_MADE, teamId: "team-b", playerId: "player-3", timestampSec: 5 }, // b's 2nd ends: made
      ],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(2);
    expect(possessions.get("team-b")).toBe(2);
  });

  it("ASSIST/BLOCK/PERSONAL_FOUL never end a possession on their own", () => {
    const possessions = computeTeamPossessions(
      [
        { actionType: ActionType.ASSIST, teamId: "team-a", playerId: "player-1", timestampSec: 1 },
        { actionType: ActionType.BLOCK, teamId: "team-b", playerId: "player-3", timestampSec: 2 },
        { actionType: ActionType.PERSONAL_FOUL, teamId: "team-a", playerId: "player-1", timestampSec: 3 },
      ],
      "team-a",
      "team-b"
    );
    expect(possessions.get("team-a")).toBe(0);
    expect(possessions.get("team-b")).toBe(0);
  });
});

describe("sumStatLines", () => {
  it("sums stat columns and sets gamesPlayed to the number of rows summed", () => {
    const summed = sumStatLines([
      { ...emptyLine(), points: 10, assists: 2, possessions: 5 },
      { ...emptyLine(), points: 8, assists: 1, possessions: 4 },
      { ...emptyLine(), points: 15, assists: 4, possessions: 9 },
    ]);
    expect(summed.points).toBe(33);
    expect(summed.assists).toBe(7);
    expect(summed.possessions).toBe(18);
    expect(summed.gamesPlayed).toBe(3);
  });

  it("returns all zeros with gamesPlayed 0 for an empty list", () => {
    expect(sumStatLines([])).toMatchObject({ gamesPlayed: 0, points: 0, possessions: 0 });
  });
});

function emptyLine() {
  return {
    gamesPlayed: 1,
    points: 0,
    shots1ptMade: 0,
    shots1ptAtt: 0,
    shots2ptMade: 0,
    shots2ptAtt: 0,
    ftMade: 0,
    ftAtt: 0,
    offRebounds: 0,
    defRebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    personalFouls: 0,
    possessions: 0,
  };
}

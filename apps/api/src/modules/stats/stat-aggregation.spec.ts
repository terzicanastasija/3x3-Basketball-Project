import { ActionType } from "@3x3/shared";
import { aggregateMatchTags, sumStatLines } from "./stat-aggregation";

describe("aggregateMatchTags", () => {
  it("computes exact stat lines from a small hand-counted fixture", () => {
    // Team A: player-1 scores a 2pt (made), misses a 2pt, gets an assist. Player-2 gets an
    // offensive rebound. Team B: player-3 makes a free throw, commits a foul.
    const { players, teams } = aggregateMatchTags([
      { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.SHOT_2PT_MISSED, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.ASSIST, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.OFFENSIVE_REBOUND, teamId: "team-a", playerId: "player-2" },
      { actionType: ActionType.FREE_THROW_MADE, teamId: "team-b", playerId: "player-3" },
      { actionType: ActionType.PERSONAL_FOUL, teamId: "team-b", playerId: "player-3" },
    ]);

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
    const { players } = aggregateMatchTags([
      { actionType: ActionType.STEAL, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.TURNOVER, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.BLOCK, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.DEFENSIVE_REBOUND, teamId: "team-a", playerId: "player-1" },
    ]);
    expect(players.get("player-1")?.points).toBe(0);
  });

  it("credits a team-only action (no playerId) to the team but not to any player", () => {
    const { players, teams } = aggregateMatchTags([
      { actionType: ActionType.TURNOVER, teamId: "team-a", playerId: null },
    ]);
    expect(teams.get("team-a")).toMatchObject({ turnovers: 1 });
    expect(players.size).toBe(0);
  });

  it("gamesPlayed is 1 per touched player/team regardless of tag count", () => {
    const { players, teams } = aggregateMatchTags([
      { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1" },
      { actionType: ActionType.SHOT_2PT_MADE, teamId: "team-a", playerId: "player-1" },
    ]);
    expect(players.get("player-1")?.gamesPlayed).toBe(1);
    expect(teams.get("team-a")?.gamesPlayed).toBe(1);
  });
});

describe("sumStatLines", () => {
  it("sums stat columns and sets gamesPlayed to the number of rows summed", () => {
    const summed = sumStatLines([
      { ...emptyLine(), points: 10, assists: 2 },
      { ...emptyLine(), points: 8, assists: 1 },
      { ...emptyLine(), points: 15, assists: 4 },
    ]);
    expect(summed.points).toBe(33);
    expect(summed.assists).toBe(7);
    expect(summed.gamesPlayed).toBe(3);
  });

  it("returns all zeros with gamesPlayed 0 for an empty list", () => {
    expect(sumStatLines([])).toMatchObject({ gamesPlayed: 0, points: 0 });
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
  };
}

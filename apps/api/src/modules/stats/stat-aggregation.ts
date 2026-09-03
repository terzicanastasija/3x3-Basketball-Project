import { ActionType, pointValueForActionType } from "@3x3/shared";

export interface ActionTagFixture {
  actionType: ActionType;
  teamId: string;
  playerId: string | null;
  timestampSec: number;
}

export interface StatLine {
  gamesPlayed: number;
  points: number;
  shots1ptMade: number;
  shots1ptAtt: number;
  shots2ptMade: number;
  shots2ptAtt: number;
  ftMade: number;
  ftAtt: number;
  offRebounds: number;
  defRebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  personalFouls: number;
  // Team-only (see computeTeamPossessions below) — always 0 on a player's line.
  possessions: number;
}

export function emptyStatLine(gamesPlayed = 1): StatLine {
  return {
    gamesPlayed,
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

// Sums the per-stat columns of several StatLines (used to roll MATCH rows up into
// TOURNAMENT/CAREER rows). gamesPlayed is intentionally NOT summed here — the caller sets it
// to the number of rows being summed (one MATCH row = one game played).
export function sumStatLines(lines: StatLine[]): StatLine {
  const total = emptyStatLine(0);
  for (const line of lines) {
    total.points += line.points;
    total.shots1ptMade += line.shots1ptMade;
    total.shots1ptAtt += line.shots1ptAtt;
    total.shots2ptMade += line.shots2ptMade;
    total.shots2ptAtt += line.shots2ptAtt;
    total.ftMade += line.ftMade;
    total.ftAtt += line.ftAtt;
    total.offRebounds += line.offRebounds;
    total.defRebounds += line.defRebounds;
    total.assists += line.assists;
    total.turnovers += line.turnovers;
    total.steals += line.steals;
    total.blocks += line.blocks;
    total.personalFouls += line.personalFouls;
    total.possessions += line.possessions;
  }
  total.gamesPlayed = lines.length;
  return total;
}

const MADE_SHOT_TYPES: ActionType[] = [
  ActionType.SHOT_2PT_MADE,
  ActionType.SHOT_1PT_MADE,
  ActionType.FREE_THROW_MADE,
];
const MISSED_SHOT_TYPES: ActionType[] = [
  ActionType.SHOT_2PT_MISSED,
  ActionType.SHOT_1PT_MISSED,
  ActionType.FREE_THROW_MISSED,
];

// Exact possession count from the actual tagged event sequence — not the usual box-score
// estimate formula (FGA - OREB + TOV + 0.44*FTA) other tools use when they only have final
// totals, since this app has real timestamped play-by-play and can walk it directly instead of
// guessing. A team's possession ends when: they score, they turn the ball over (including being
// stolen from), or they miss and the OTHER team gets the defensive rebound (missing and keeping
// their own offensive rebound does NOT end it). Every possession ends exactly once, so counting
// endings == counting possessions (off by at most 1 per team: the game's final possession has no
// "ending" tag if it expires on the clock without a score — an accepted, documented gap, the
// same category as this codebase's other approximations e.g. the ffmpeg clip-boundary drift).
//
// Known simplification: an "and-1" trip (made basket immediately followed by its resulting free
// throw) is counted as two possession-endings instead of one, since tags don't carry an explicit
// link between a shooting foul's basket and its free throw. Rare enough at this data scale not
// to be worth the schema complexity of linking them.
export function computeTeamPossessions(
  tags: ActionTagFixture[],
  homeTeamId: string,
  awayTeamId: string
): Map<string, number> {
  const possessions = new Map<string, number>([
    [homeTeamId, 0],
    [awayTeamId, 0],
  ]);
  const otherTeam = (teamId: string) => (teamId === homeTeamId ? awayTeamId : homeTeamId);
  const credit = (teamId: string) => possessions.set(teamId, (possessions.get(teamId) ?? 0) + 1);

  const sorted = [...tags].sort((a, b) => a.timestampSec - b.timestampSec);
  let pendingMissTeam: string | null = null;

  for (const tag of sorted) {
    if (MADE_SHOT_TYPES.includes(tag.actionType)) {
      credit(tag.teamId);
      pendingMissTeam = null;
    } else if (MISSED_SHOT_TYPES.includes(tag.actionType)) {
      pendingMissTeam = tag.teamId;
    } else if (tag.actionType === ActionType.OFFENSIVE_REBOUND) {
      pendingMissTeam = null; // same team keeps the ball — not a new possession
    } else if (tag.actionType === ActionType.DEFENSIVE_REBOUND) {
      if (pendingMissTeam) credit(pendingMissTeam);
      pendingMissTeam = null;
    } else if (tag.actionType === ActionType.TURNOVER) {
      credit(tag.teamId);
      pendingMissTeam = null;
    } else if (tag.actionType === ActionType.STEAL) {
      credit(otherTeam(tag.teamId));
      pendingMissTeam = null;
    }
    // ASSIST, BLOCK, PERSONAL_FOUL never end a possession on their own.
  }

  return possessions;
}

// Pure aggregation of one match's ActionTag rows into per-player and per-team MATCH-scope
// stat lines. No DB access — this is the piece worth testing exhaustively against hand-built
// fixtures, since a mistake here silently corrupts every dashboard downstream.
export function aggregateMatchTags(
  tags: ActionTagFixture[],
  homeTeamId: string,
  awayTeamId: string
): {
  players: Map<string, StatLine>;
  teams: Map<string, StatLine>;
} {
  const players = new Map<string, StatLine>();
  const teams = new Map<string, StatLine>();

  const applyTag = (map: Map<string, StatLine>, key: string, tag: ActionTagFixture) => {
    const line = map.get(key) ?? emptyStatLine();
    switch (tag.actionType) {
      case ActionType.SHOT_2PT_MADE:
        line.shots2ptMade += 1;
        line.shots2ptAtt += 1;
        break;
      case ActionType.SHOT_2PT_MISSED:
        line.shots2ptAtt += 1;
        break;
      case ActionType.SHOT_1PT_MADE:
        line.shots1ptMade += 1;
        line.shots1ptAtt += 1;
        break;
      case ActionType.SHOT_1PT_MISSED:
        line.shots1ptAtt += 1;
        break;
      case ActionType.FREE_THROW_MADE:
        line.ftMade += 1;
        line.ftAtt += 1;
        break;
      case ActionType.FREE_THROW_MISSED:
        line.ftAtt += 1;
        break;
      case ActionType.OFFENSIVE_REBOUND:
        line.offRebounds += 1;
        break;
      case ActionType.DEFENSIVE_REBOUND:
        line.defRebounds += 1;
        break;
      case ActionType.ASSIST:
        line.assists += 1;
        break;
      case ActionType.TURNOVER:
        line.turnovers += 1;
        break;
      case ActionType.STEAL:
        line.steals += 1;
        break;
      case ActionType.BLOCK:
        line.blocks += 1;
        break;
      case ActionType.PERSONAL_FOUL:
        line.personalFouls += 1;
        break;
    }
    // Never re-derive the point mapping by hand — reuse the single source of truth so this
    // can never drift from what TagsService used when the tag was actually created.
    const pointValue = pointValueForActionType(tag.actionType);
    if (pointValue) {
      line.points += pointValue;
    }
    map.set(key, line);
  };

  for (const tag of tags) {
    applyTag(teams, tag.teamId, tag);
    if (tag.playerId) {
      applyTag(players, tag.playerId, tag);
    }
  }

  // Possessions are computed separately (a sequential walk, not a per-tag switch) and merged
  // in — team-only, matching StatLine's own "always 0 on a player's line" contract above.
  const teamPossessions = computeTeamPossessions(tags, homeTeamId, awayTeamId);
  for (const [teamId, count] of teamPossessions) {
    const line = teams.get(teamId) ?? emptyStatLine();
    line.possessions = count;
    teams.set(teamId, line);
  }

  return { players, teams };
}

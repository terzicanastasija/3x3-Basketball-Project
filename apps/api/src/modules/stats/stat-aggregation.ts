import { ActionType, pointValueForActionType } from "@3x3/shared";

export interface ActionTagFixture {
  actionType: ActionType;
  teamId: string;
  playerId: string | null;
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
  }
  total.gamesPlayed = lines.length;
  return total;
}

// Pure aggregation of one match's ActionTag rows into per-player and per-team MATCH-scope
// stat lines. No DB access — this is the piece worth testing exhaustively against hand-built
// fixtures, since a mistake here silently corrupts every dashboard downstream.
export function aggregateMatchTags(tags: ActionTagFixture[]): {
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

  return { players, teams };
}

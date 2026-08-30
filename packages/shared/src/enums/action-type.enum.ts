// The fixed list of taggable actions. No free text is ever allowed for action type.
export enum ActionType {
  SHOT_2PT_MADE = "SHOT_2PT_MADE",
  SHOT_2PT_MISSED = "SHOT_2PT_MISSED",
  SHOT_1PT_MADE = "SHOT_1PT_MADE",
  SHOT_1PT_MISSED = "SHOT_1PT_MISSED",
  FREE_THROW_MADE = "FREE_THROW_MADE",
  FREE_THROW_MISSED = "FREE_THROW_MISSED",
  OFFENSIVE_REBOUND = "OFFENSIVE_REBOUND",
  DEFENSIVE_REBOUND = "DEFENSIVE_REBOUND",
  ASSIST = "ASSIST",
  TURNOVER = "TURNOVER",
  STEAL = "STEAL",
  BLOCK = "BLOCK",
  PERSONAL_FOUL = "PERSONAL_FOUL",
}

// Action types that require a "related player" (assist passer, blocked/stolen-from opponent).
export const ACTION_TYPES_WITH_RELATED_PLAYER: ActionType[] = [
  ActionType.ASSIST,
  ActionType.STEAL,
  ActionType.BLOCK,
];

// Action types that represent a shot attempt and therefore have a made/missed outcome + point value.
export const SHOT_ACTION_TYPES: ActionType[] = [
  ActionType.SHOT_2PT_MADE,
  ActionType.SHOT_2PT_MISSED,
  ActionType.SHOT_1PT_MADE,
  ActionType.SHOT_1PT_MISSED,
  ActionType.FREE_THROW_MADE,
  ActionType.FREE_THROW_MISSED,
];

// 3x3 scoring: inside-arc / free throw = 1, beyond-arc = 2. Never 3, unlike 5x5.
// Returns null for non-made or non-shot action types.
export function pointValueForActionType(actionType: ActionType): 1 | 2 | null {
  switch (actionType) {
    case ActionType.SHOT_2PT_MADE:
      return 2;
    case ActionType.SHOT_1PT_MADE:
    case ActionType.FREE_THROW_MADE:
      return 1;
    default:
      return null;
  }
}

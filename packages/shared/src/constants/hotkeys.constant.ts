import { ActionType } from "../enums/action-type.enum";

// Single source of truth for the tagging screen's keyboard shortcuts.
// Keys stay fixed across locales; only the displayed label is localized (via i18n keys below).
export const ACTION_TYPE_HOTKEYS: Record<ActionType, string> = {
  [ActionType.SHOT_2PT_MADE]: "1",
  [ActionType.SHOT_2PT_MISSED]: "2",
  [ActionType.SHOT_1PT_MADE]: "3",
  [ActionType.SHOT_1PT_MISSED]: "4",
  [ActionType.FREE_THROW_MADE]: "5",
  [ActionType.FREE_THROW_MISSED]: "6",
  [ActionType.OFFENSIVE_REBOUND]: "o",
  [ActionType.DEFENSIVE_REBOUND]: "d",
  [ActionType.ASSIST]: "a",
  [ActionType.TURNOVER]: "t",
  [ActionType.STEAL]: "s",
  [ActionType.BLOCK]: "b",
  [ActionType.PERSONAL_FOUL]: "f",
};

// i18n key each action type's label is translated under (see apps/web/src/i18n/locales/*/tagging.json).
export const ACTION_TYPE_I18N_KEY: Record<ActionType, string> = Object.fromEntries(
  Object.values(ActionType).map((actionType) => [actionType, `tagging.actionType.${actionType}`])
) as Record<ActionType, string>;

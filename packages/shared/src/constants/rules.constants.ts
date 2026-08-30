// FIBA 3x3 rules that shape the data model. Do not "fix" these to 5x5 values.

/** A match ends at 10:00 net playing time, or immediately at 21 points, whichever first. */
export const MATCH_TIME_MINUTES = 10;
export const MATCH_POINT_TARGET = 21;

/** Shot clock is 12 seconds per possession (not 24). */
export const SHOT_CLOCK_SECONDS = 12;

/** 4 players per team per match: 3 on court + 1 substitute. */
export const PLAYERS_PER_TEAM = 4;
export const PLAYERS_ON_COURT = 3;

/** Team fouls: bonus (1 free throw) starts at the 7th team foul, two free throws from the 10th. */
export const TEAM_FOUL_BONUS_THRESHOLD = 7;
export const TEAM_FOUL_TWO_SHOT_THRESHOLD = 10;

/** Default clip window around a tagged action's timestamp, for FILE-sourced video only. */
export const CLIP_SECONDS_BEFORE = 5;
export const CLIP_SECONDS_AFTER = 3;

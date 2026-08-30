export enum Handedness {
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  AMBIDEXTROUS = "AMBIDEXTROUS",
  UNKNOWN = "UNKNOWN",
}

// StatSnapshot aggregation scope. Kept as a string union (not a DB enum with 3 tables)
// so there is one write path for match/tournament/career snapshots.
export enum StatScope {
  MATCH = "MATCH",
  TOURNAMENT = "TOURNAMENT",
  CAREER = "CAREER",
}

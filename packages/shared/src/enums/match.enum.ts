export enum MatchStatus {
  SCHEDULED = "SCHEDULED",
  IN_PROGRESS = "IN_PROGRESS",
  PLAYED = "PLAYED",
}

// Regular time: hit the point target (21) or the 10-minute clock expires with a leader.
// Sudden death: tied at the time cap, next basket wins.
export enum MatchEndType {
  REGULAR_TIME = "REGULAR_TIME",
  SUDDEN_DEATH = "SUDDEN_DEATH",
}

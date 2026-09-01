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

// Nullable on Match — not every match belongs to a bracket (a simple friendly or regular-season
// league game may have no phase at all). A standard group-stage-then-single-elimination-bracket
// shape, common across most amateur/pro basketball tournament formats, 3x3 included.
export enum MatchPhase {
  GROUP_STAGE = "GROUP_STAGE",
  ROUND_OF_16 = "ROUND_OF_16",
  QUARTERFINAL = "QUARTERFINAL",
  SEMIFINAL = "SEMIFINAL",
  THIRD_PLACE = "THIRD_PLACE",
  FINAL = "FINAL",
}

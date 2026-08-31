import { Prisma, StatScope } from "@prisma/client";

export interface StatSnapshotKey {
  scopeType: StatScope;
  playerId: string | null;
  teamId: string | null;
  matchId: string | null;
  tournamentId: string | null;
}

// Prisma's generated compound-unique input for @@unique([scopeType, playerId, teamId, matchId,
// tournamentId]) declares every field as non-nullable `string`, even though the underlying
// columns are nullable and Prisma's runtime correctly emits `IS NULL` SQL when you pass null —
// a known type-generation gap for nullable compound-unique fields, not a real DB constraint.
// This cast is the single place that gap is papered over.
export function statSnapshotUniqueWhere(
  key: StatSnapshotKey
): NonNullable<Prisma.StatSnapshotWhereUniqueInput["scopeType_playerId_teamId_matchId_tournamentId"]> {
  return key as never;
}

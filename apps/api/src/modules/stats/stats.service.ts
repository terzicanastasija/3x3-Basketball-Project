import { Injectable } from "@nestjs/common";
import { Prisma, StatScope } from "@prisma/client";
import { ActionType } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { aggregateMatchTags, StatLine, sumStatLines } from "./stat-aggregation";

type Tx = Prisma.TransactionClient;

interface StatSnapshotKey {
  scopeType: StatScope;
  playerId: string | null;
  teamId: string | null;
  matchId: string | null;
  tournamentId: string | null;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasMatchSnapshot(matchId: string): Promise<boolean> {
    const count = await this.prisma.statSnapshot.count({
      where: { scopeType: StatScope.MATCH, matchId },
    });
    return count > 0;
  }

  // MATCH scope (full recompute from this match's tags) -> TOURNAMENT scope (summed from the
  // cached MATCH rows) -> CAREER scope, players only (summed from all of a player's MATCH
  // rows system-wide). Never re-scans raw ActionTag rows outside the MATCH layer, so recompute
  // cost stays proportional to matches touched, not total system size.
  async recomputeForMatch(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      select: { tournamentId: true },
    });
    const tags = await this.prisma.actionTag.findMany({
      where: { matchId },
      select: { actionType: true, teamId: true, playerId: true },
    });
    // Prisma generates its own ActionType enum from schema.prisma (kept in sync by hand with
    // @3x3/shared's — see the schema comment); this boundary cast is the same pattern
    // role.mapper.ts already uses for Role, just inline since it's only needed here.
    const { players, teams } = aggregateMatchTags(
      tags.map((tag) => ({ ...tag, actionType: tag.actionType as unknown as ActionType }))
    );

    await this.prisma.$transaction(async (tx) => {
      for (const [playerId, line] of players) {
        await this.upsertSnapshot(
          tx,
          { scopeType: StatScope.MATCH, playerId, teamId: null, matchId, tournamentId: null },
          line
        );
      }
      for (const [teamId, line] of teams) {
        await this.upsertSnapshot(
          tx,
          { scopeType: StatScope.MATCH, playerId: null, teamId, matchId, tournamentId: null },
          line
        );
      }

      for (const playerId of players.keys()) {
        await this.recomputeTournamentScope(tx, { playerId, teamId: null }, match.tournamentId);
        await this.recomputeCareerScope(tx, playerId);
      }
      for (const teamId of teams.keys()) {
        await this.recomputeTournamentScope(tx, { playerId: null, teamId }, match.tournamentId);
      }
    });
  }

  private async recomputeTournamentScope(
    tx: Tx,
    who: { playerId: string | null; teamId: string | null },
    tournamentId: string
  ) {
    const matchIds = (
      await tx.match.findMany({ where: { tournamentId }, select: { id: true } })
    ).map((m) => m.id);

    const matchRows = await tx.statSnapshot.findMany({
      where: { scopeType: StatScope.MATCH, playerId: who.playerId, teamId: who.teamId, matchId: { in: matchIds } },
    });
    const summed = sumStatLines(matchRows);

    await this.upsertSnapshot(
      tx,
      {
        scopeType: StatScope.TOURNAMENT,
        playerId: who.playerId,
        teamId: who.teamId,
        matchId: null,
        tournamentId,
      },
      summed
    );
  }

  private async recomputeCareerScope(tx: Tx, playerId: string) {
    const matchRows = await tx.statSnapshot.findMany({
      where: { scopeType: StatScope.MATCH, playerId },
    });
    const summed = sumStatLines(matchRows);

    await this.upsertSnapshot(
      tx,
      { scopeType: StatScope.CAREER, playerId, teamId: null, matchId: null, tournamentId: null },
      summed
    );
  }

  // Prisma's upsert() requires a compound-unique `where` with no nulls at runtime, even though
  // the underlying columns/index are nullable — a known limitation, not just a type gap. So
  // this does the upsert by hand: a plain findFirst (which handles null fine) followed by a
  // create or an update-by-id.
  private async upsertSnapshot(tx: Tx, key: StatSnapshotKey, line: StatLine) {
    const existing = await tx.statSnapshot.findFirst({
      where: {
        scopeType: key.scopeType,
        playerId: key.playerId,
        teamId: key.teamId,
        matchId: key.matchId,
        tournamentId: key.tournamentId,
      },
      select: { id: true },
    });
    if (existing) {
      return tx.statSnapshot.update({ where: { id: existing.id }, data: { ...line } });
    }
    return tx.statSnapshot.create({ data: { ...key, ...line } });
  }
}

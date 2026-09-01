import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { AddRosterPlayerDto } from "@3x3/shared";

@Injectable()
export class RostersService {
  constructor(private readonly prisma: PrismaService) {}

  async find(teamId: string, tournamentId: string, clubContext: ClubContext) {
    await this.assertCanRead(teamId, clubContext);
    const roster = await this.prisma.roster.findUnique({
      where: { teamId_tournamentId: { teamId, tournamentId } },
      include: {
        players: {
          include: { player: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!roster) {
      throw new NotFoundException("No roster yet for this team and tournament.");
    }
    return roster;
  }

  async createOrGet(user: AuthenticatedUser, teamId: string, tournamentId: string) {
    await this.assertIsAdmin(user, teamId);
    const existing = await this.prisma.roster.findUnique({
      where: { teamId_tournamentId: { teamId, tournamentId } },
      include: { players: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.roster.create({
      data: { teamId, tournamentId },
      include: { players: true },
    });
  }

  async addPlayer(user: AuthenticatedUser, teamId: string, tournamentId: string, dto: AddRosterPlayerDto) {
    await this.assertIsAdmin(user, teamId);
    const roster = await this.createOrGet(user, teamId, tournamentId);
    return this.prisma.rosterPlayer.upsert({
      where: { rosterId_playerId: { rosterId: roster.id, playerId: dto.playerId } },
      update: { jerseyNumber: dto.jerseyNumber },
      create: { rosterId: roster.id, playerId: dto.playerId, jerseyNumber: dto.jerseyNumber },
      include: { player: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async removePlayer(user: AuthenticatedUser, teamId: string, tournamentId: string, playerId: string) {
    await this.assertIsAdmin(user, teamId);
    const roster = await this.prisma.roster.findUnique({
      where: { teamId_tournamentId: { teamId, tournamentId } },
    });
    if (!roster) {
      throw new NotFoundException("No roster yet for this team and tournament.");
    }
    await this.prisma.rosterPlayer.delete({
      where: { rosterId_playerId: { rosterId: roster.id, playerId } },
    });
  }

  // Reads stay open to anyone with access to the team's club — `accessibleClubIds === "ALL"`
  // covers both Superadmin and Scout here (Scout needs to see any roster to know who's on the
  // court while tagging; see ClubScopeGuard's comment on why Scout gets that sentinel too).
  private async assertCanRead(teamId: string, clubContext: ClubContext) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { clubId: true } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }
    if (clubContext.accessibleClubIds === "ALL") return;
    if (!clubContext.accessibleClubIds.includes(team.clubId)) {
      throw new ForbiddenException("You do not have access to this club.");
    }
  }

  // Roster management (which players played for which team in a tournament) is Admin-only —
  // see PROGRESS.md's RBAC overhaul note. Deliberately checks `user.isSuperadmin` directly
  // rather than `clubContext.accessibleClubIds === "ALL"`, because that sentinel is also true
  // for a Scout (read-only widening, see ClubScopeGuard) — a Scout must NOT get roster-write
  // access just because they can read any club's roster.
  private async assertIsAdmin(user: AuthenticatedUser, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can manage rosters.");
    }
  }
}

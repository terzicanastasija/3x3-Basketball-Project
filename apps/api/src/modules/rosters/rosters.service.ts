import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ClubContext } from "../../common/types/authenticated-request";
import { AddRosterPlayerDto } from "@3x3/shared";

const EDIT_ROLES: Role[] = [Role.CLUB_ADMIN, Role.COACH];

@Injectable()
export class RostersService {
  constructor(private readonly prisma: PrismaService) {}

  async find(teamId: string, tournamentId: string, clubContext: ClubContext) {
    await this.assertTeamEditable(teamId, clubContext, /* readOnly */ true);
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

  async createOrGet(teamId: string, tournamentId: string, clubContext: ClubContext) {
    await this.assertTeamEditable(teamId, clubContext);
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

  async addPlayer(teamId: string, tournamentId: string, dto: AddRosterPlayerDto, clubContext: ClubContext) {
    await this.assertTeamEditable(teamId, clubContext);
    const roster = await this.createOrGet(teamId, tournamentId, clubContext);
    return this.prisma.rosterPlayer.upsert({
      where: { rosterId_playerId: { rosterId: roster.id, playerId: dto.playerId } },
      update: { jerseyNumber: dto.jerseyNumber },
      create: { rosterId: roster.id, playerId: dto.playerId, jerseyNumber: dto.jerseyNumber },
      include: { player: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async removePlayer(teamId: string, tournamentId: string, playerId: string, clubContext: ClubContext) {
    await this.assertTeamEditable(teamId, clubContext);
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

  private async assertTeamEditable(teamId: string, clubContext: ClubContext, readOnly = false) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { clubId: true } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }
    if (clubContext.accessibleClubIds === "ALL") return;

    if (readOnly) {
      if (!clubContext.accessibleClubIds.includes(team.clubId)) {
        throw new ForbiddenException("You do not have access to this club.");
      }
      return;
    }

    const role = clubContext.roleByClubId[team.clubId];
    if (!role || !EDIT_ROLES.includes(role)) {
      throw new ForbiddenException("You must be a club admin or coach of this team's club.");
    }
  }
}

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ClubContext } from "../../common/types/authenticated-request";
import { CreateTeamDto, UpdateTeamDto } from "@3x3/shared";

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForClub(clubId: string, clubContext: ClubContext) {
    this.assertClubAccessible(clubId, clubContext);
    return this.prisma.team.findMany({ where: { clubId }, orderBy: { name: "asc" } });
  }

  async findOne(teamId: string, clubContext: ClubContext) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException("Team not found.");
    }
    this.assertClubAccessible(team.clubId, clubContext);
    return team;
  }

  async create(clubId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({ data: { ...dto, clubId } });
  }

  async update(clubId: string, teamId: string, dto: UpdateTeamDto) {
    await this.ensureBelongsToClub(teamId, clubId);
    return this.prisma.team.update({ where: { id: teamId }, data: dto });
  }

  async remove(clubId: string, teamId: string) {
    await this.ensureBelongsToClub(teamId, clubId);
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  private assertClubAccessible(clubId: string, clubContext: ClubContext) {
    if (clubContext.accessibleClubIds === "ALL") return;
    if (!clubContext.accessibleClubIds.includes(clubId)) {
      throw new ForbiddenException("You do not have access to this club.");
    }
  }

  private async ensureBelongsToClub(teamId: string, clubId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { clubId: true } });
    if (!team || team.clubId !== clubId) {
      throw new NotFoundException("Team not found in this club.");
    }
  }
}

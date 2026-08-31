import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { CreateTournamentDto, UpdateTournamentDto } from "@3x3/shared";

// Full Tournament CRUD (Phase 2) — supersedes the Phase-1 read-only picker stub.
@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Reads are open to any authenticated user, same spirit as PlayersModule from Phase 1 —
  // tournaments are cross-club discovery, not club-private data.
  list() {
    return this.prisma.tournament.findMany({ orderBy: { startDate: "desc" } });
  }

  findOne(tournamentId: string) {
    return this.ensureExists(tournamentId);
  }

  create(user: AuthenticatedUser, clubContext: ClubContext, dto: CreateTournamentDto) {
    if (!user.isSuperadmin) {
      if (dto.clubId) {
        this.assertClubAdmin(clubContext, dto.clubId);
      } else {
        // Clubless tournament (multi-club event, no single organizer): allow any caller who
        // is CLUB_ADMIN of at least one club, rather than requiring superadmin — judgment
        // call, documented in PROGRESS.md.
        const isAnyClubAdmin = Object.values(clubContext.roleByClubId).includes(Role.CLUB_ADMIN);
        if (!isAnyClubAdmin) {
          throw new ForbiddenException("You must be a CLUB_ADMIN of some club to create a tournament.");
        }
      }
    }
    return this.prisma.tournament.create({ data: dto });
  }

  async update(
    user: AuthenticatedUser,
    clubContext: ClubContext,
    tournamentId: string,
    dto: UpdateTournamentDto
  ) {
    const tournament = await this.ensureExists(tournamentId);
    this.assertCanManage(user, clubContext, tournament.clubId);
    return this.prisma.tournament.update({ where: { id: tournamentId }, data: dto });
  }

  async remove(user: AuthenticatedUser, clubContext: ClubContext, tournamentId: string) {
    const tournament = await this.ensureExists(tournamentId);
    this.assertCanManage(user, clubContext, tournament.clubId);
    await this.prisma.tournament.delete({ where: { id: tournamentId } });
  }

  private async ensureExists(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException("Tournament not found.");
    }
    return tournament;
  }

  private assertCanManage(user: AuthenticatedUser, clubContext: ClubContext, clubId: string | null) {
    if (user.isSuperadmin) return;
    if (!clubId) {
      throw new ForbiddenException("Only a superadmin can modify a tournament with no organizing club.");
    }
    this.assertClubAdmin(clubContext, clubId);
  }

  private assertClubAdmin(clubContext: ClubContext, clubId: string) {
    if (clubContext.roleByClubId[clubId] !== Role.CLUB_ADMIN) {
      throw new ForbiddenException("You must be CLUB_ADMIN of the organizing club.");
    }
  }
}

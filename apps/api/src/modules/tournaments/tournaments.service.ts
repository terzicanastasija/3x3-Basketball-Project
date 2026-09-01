import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
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

  async create(user: AuthenticatedUser, dto: CreateTournamentDto) {
    this.assertIsAdmin(user);
    return this.prisma.tournament.create({ data: dto });
  }

  async update(user: AuthenticatedUser, tournamentId: string, dto: UpdateTournamentDto) {
    this.assertIsAdmin(user);
    await this.ensureExists(tournamentId);
    return this.prisma.tournament.update({ where: { id: tournamentId }, data: dto });
  }

  async remove(user: AuthenticatedUser, tournamentId: string) {
    this.assertIsAdmin(user);
    await this.ensureExists(tournamentId);
    await this.prisma.tournament.delete({ where: { id: tournamentId } });
  }

  private async ensureExists(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException("Tournament not found.");
    }
    return tournament;
  }

  // Tournament management (create/edit/delete) is Admin-only — see PROGRESS.md's RBAC
  // overhaul note for why this is no longer shared with CLUB_ADMIN.
  private assertIsAdmin(user: AuthenticatedUser) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can manage tournaments.");
    }
  }
}

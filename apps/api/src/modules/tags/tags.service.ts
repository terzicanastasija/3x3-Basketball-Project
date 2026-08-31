import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { pointValueForActionType, Role } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { CreateTagDto, UpdateTagDto } from "@3x3/shared";
import { StatRecomputeQueueService } from "../../common/queue/stat-recompute-queue.service";

const MANAGE_ROLES: Role[] = [Role.CLUB_ADMIN, Role.COACH];

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statRecomputeQueue: StatRecomputeQueueService
  ) {}

  listForMatch(matchId: string) {
    return this.prisma.actionTag.findMany({
      where: { matchId },
      orderBy: { timestampSec: "asc" },
    });
  }

  async create(user: AuthenticatedUser, clubContext: ClubContext, matchId: string, dto: CreateTagDto) {
    const match = await this.ensureUnlockedAndManageable(user, clubContext, matchId);
    if (dto.teamId !== match.homeTeamId && dto.teamId !== match.awayTeamId) {
      throw new BadRequestException("teamId must be the match's home or away team.");
    }

    return this.prisma.actionTag.create({
      data: {
        matchId,
        videoAssetId: dto.videoAssetId,
        timestampSec: dto.timestampSec,
        actionType: dto.actionType,
        teamId: dto.teamId,
        playerId: dto.playerId,
        relatedPlayerId: dto.relatedPlayerId,
        isMade: dto.isMade,
        // Never trust a client-supplied point value — always derive it server-side.
        pointValue: pointValueForActionType(dto.actionType),
        createdById: user.id,
      },
    });
  }

  async update(user: AuthenticatedUser, clubContext: ClubContext, tagId: string, dto: UpdateTagDto) {
    const tag = await this.findTagOrThrow(tagId);
    await this.ensureUnlockedAndManageable(user, clubContext, tag.matchId);

    return this.prisma.actionTag.update({
      where: { id: tagId },
      data: {
        ...dto,
        // Recompute pointValue whenever actionType changes; leave it untouched otherwise.
        ...(dto.actionType ? { pointValue: pointValueForActionType(dto.actionType) } : {}),
      },
    });
  }

  async remove(user: AuthenticatedUser, clubContext: ClubContext, tagId: string) {
    const tag = await this.findTagOrThrow(tagId);
    await this.ensureUnlockedAndManageable(user, clubContext, tag.matchId);
    await this.prisma.actionTag.delete({ where: { id: tagId } });
  }

  async lockMatch(user: AuthenticatedUser, clubContext: ClubContext, matchId: string) {
    const match = await this.assertCanManageMatch(user, clubContext, matchId);
    if (match.lockedAt) {
      // Idempotent: locking an already-locked match is a no-op, not an error — a coach
      // re-clicking "Lock match" shouldn't see a failure. Also deliberately does NOT
      // re-enqueue a recompute — only a first-time lock triggers one.
      return match;
    }
    const locked = await this.prisma.match.update({
      where: { id: matchId },
      data: { lockedAt: new Date() },
    });
    await this.statRecomputeQueue.enqueueMatchRecompute(matchId);
    return locked;
  }

  private async findTagOrThrow(tagId: string) {
    const tag = await this.prisma.actionTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException("Tag not found.");
    }
    return tag;
  }

  private async ensureUnlockedAndManageable(user: AuthenticatedUser, clubContext: ClubContext, matchId: string) {
    const match = await this.assertCanManageMatch(user, clubContext, matchId);
    if (match.lockedAt) {
      throw new BadRequestException("This match is locked — tags can no longer be changed.");
    }
    return match;
  }

  private async assertCanManageMatch(user: AuthenticatedUser, clubContext: ClubContext, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: { select: { clubId: true } }, awayTeam: { select: { clubId: true } } },
    });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    if (user.isSuperadmin) return match;
    const clubIds = [match.homeTeam.clubId, match.awayTeam.clubId];
    const canManage = clubIds.some((clubId) => MANAGE_ROLES.includes(clubContext.roleByClubId[clubId]));
    if (!canManage) {
      throw new ForbiddenException("You must be a club admin or coach of the home or away team's club.");
    }
    return match;
  }
}

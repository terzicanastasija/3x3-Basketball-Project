import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { pointValueForActionType, VideoSourceType } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateTagDto, UpdateTagDto } from "@3x3/shared";
import { StatRecomputeQueueService } from "../../common/queue/stat-recompute-queue.service";
import { ClipGenerationQueueService } from "../../common/queue/clip-generation-queue.service";

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statRecomputeQueue: StatRecomputeQueueService,
    private readonly clipGenerationQueue: ClipGenerationQueueService
  ) {}

  // Includes player/relatedPlayer names directly — the tag list is the only place in the app
  // that shows individual tagged actions, so without this a viewer (Coach included) has no way
  // to tell which player a given clip actually belongs to.
  listForMatch(matchId: string) {
    return this.prisma.actionTag.findMany({
      where: { matchId },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { timestampSec: "asc" },
    });
  }

  async create(user: AuthenticatedUser, matchId: string, dto: CreateTagDto) {
    const match = await this.ensureUnlockedAndManageable(user, matchId);
    if (dto.teamId !== match.homeTeamId && dto.teamId !== match.awayTeamId) {
      throw new BadRequestException("teamId must be the match's home or away team.");
    }
    if (dto.playerId) {
      await this.assertPlayerExists(dto.playerId);
    }
    if (dto.relatedPlayerId) {
      await this.assertPlayerExists(dto.relatedPlayerId);
    }

    const tag = await this.prisma.actionTag.create({
      data: {
        matchId,
        videoAssetId: dto.videoAssetId,
        timestampSec: dto.timestampSec,
        actionType: dto.actionType,
        teamId: dto.teamId,
        playerId: dto.playerId,
        relatedPlayerId: dto.relatedPlayerId,
        isMade: dto.isMade,
        clipInSec: dto.clipInSec,
        clipOutSec: dto.clipOutSec,
        // Never trust a client-supplied point value — always derive it server-side.
        pointValue: pointValueForActionType(dto.actionType),
        createdById: user.id,
      },
    });

    // Clip generation (Phase 5): only FILE-source tags get a real ffmpeg-cut clip — EXTERNAL
    // (YouTube) tags never get a ClipJob at all, just a deep link constructed on read by
    // ClipsModule. This is the only place a ClipJob is ever created.
    if (dto.videoAssetId) {
      const video = await this.prisma.videoAsset.findUnique({
        where: { id: dto.videoAssetId },
        select: { sourceType: true },
      });
      if (video?.sourceType === VideoSourceType.FILE) {
        await this.prisma.clipJob.create({ data: { actionTagId: tag.id } });
        await this.clipGenerationQueue.enqueueClipGeneration(tag.id);
      }
    }

    return tag;
  }

  async update(user: AuthenticatedUser, tagId: string, dto: UpdateTagDto) {
    const tag = await this.findTagOrThrow(tagId);
    await this.ensureUnlockedAndManageable(user, tag.matchId);

    return this.prisma.actionTag.update({
      where: { id: tagId },
      data: {
        ...dto,
        // Recompute pointValue whenever actionType changes; leave it untouched otherwise.
        ...(dto.actionType ? { pointValue: pointValueForActionType(dto.actionType) } : {}),
      },
    });
  }

  async remove(user: AuthenticatedUser, tagId: string) {
    const tag = await this.findTagOrThrow(tagId);
    await this.ensureUnlockedAndManageable(user, tag.matchId);
    await this.prisma.actionTag.delete({ where: { id: tagId } });
  }

  async lockMatch(user: AuthenticatedUser, matchId: string) {
    const match = await this.assertCanManageMatch(user, matchId);
    if (match.lockedAt) {
      // Idempotent: locking an already-locked match is a no-op, not an error — a scout
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

  private async assertPlayerExists(playerId: string) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) {
      throw new NotFoundException("Player not found.");
    }
  }

  private async findTagOrThrow(tagId: string) {
    const tag = await this.prisma.actionTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException("Tag not found.");
    }
    return tag;
  }

  private async ensureUnlockedAndManageable(user: AuthenticatedUser, matchId: string) {
    const match = await this.assertCanManageMatch(user, matchId);
    if (match.lockedAt) {
      throw new BadRequestException("This match is locked — tags can no longer be changed.");
    }
    return match;
  }

  // Tagging (and locking) is Scout-or-Admin only, globally — not club-scoped like most other
  // write paths in this app. See Role enum's SCOUT comment for why.
  private async assertCanManageMatch(user: AuthenticatedUser, matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    if (!user.isSuperadmin && !user.isScout) {
      throw new ForbiddenException("Only a Scout or Admin can manage this match's tags.");
    }
    return match;
  }
}

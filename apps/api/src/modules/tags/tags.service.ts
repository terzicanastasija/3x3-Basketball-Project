import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { pointValueForActionType, VideoSourceType } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateTagDto, TagSearchQueryDto, UpdateTagDto } from "@3x3/shared";
import { StatRecomputeQueueService } from "../../common/queue/stat-recompute-queue.service";
import { ClipGenerationQueueService } from "../../common/queue/clip-generation-queue.service";

// Shared by listForMatch and search — the tag list is the only place in the app that shows
// individual tagged actions, so without player/defender names a viewer has no way to tell who a
// given clip actually involves.
const TAG_INCLUDE = {
  player: { select: { id: true, firstName: true, lastName: true } },
  relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
  defender: { select: { id: true, firstName: true, lastName: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ActionTagInclude;

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statRecomputeQueue: StatRecomputeQueueService,
    private readonly clipGenerationQueue: ClipGenerationQueueService
  ) {}

  listForMatch(matchId: string) {
    return this.prisma.actionTag.findMany({
      where: { matchId },
      include: TAG_INCLUDE,
      orderBy: { timestampSec: "asc" },
    });
  }

  // Cross-match search — tags are already open-read (same access as listForMatch/GET
  // /matches/:matchId/tags), so this stays open to any authenticated user too. Also includes
  // match/team/tournament context per row, since (unlike listForMatch) a result can come from
  // any match — a viewer has no other way to tell which game a given row belongs to.
  search(query: TagSearchQueryDto) {
    const where: Prisma.ActionTagWhereInput = {};
    if (query.matchId) where.matchId = query.matchId;
    if (query.teamId) where.teamId = query.teamId;
    if (query.playerId) where.playerId = query.playerId;
    if (query.defenderId) where.defenderId = query.defenderId;
    if (query.actionType) where.actionType = query.actionType;
    if (query.isMade !== undefined) where.isMade = query.isMade;
    if (query.reviewed !== undefined) {
      where.reviewedAt = query.reviewed ? { not: null } : null;
    }
    if (query.tournamentId) {
      where.match = { tournamentId: query.tournamentId };
    }

    return this.prisma.actionTag.findMany({
      where,
      include: {
        ...TAG_INCLUDE,
        match: {
          select: {
            id: true,
            tournamentId: true,
            phase: true,
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            tournament: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ match: { scheduledAt: "desc" } }, { timestampSec: "asc" }],
      take: 200,
    });
  }

  // QA toggle, Admin-only: marks a tag reviewed (or clears it back to unreviewed if it already
  // was). Deliberately not folded into update() — review state isn't part of what a Scout edits,
  // it's an Admin checking a Scout's work.
  async review(user: AuthenticatedUser, tagId: string) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can mark a tag as reviewed.");
    }
    const tag = await this.findTagOrThrow(tagId);
    return this.prisma.actionTag.update({
      where: { id: tagId },
      data: tag.reviewedAt ? { reviewedAt: null, reviewedById: null } : { reviewedAt: new Date(), reviewedById: user.id },
      include: TAG_INCLUDE,
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
    if (dto.defenderId) {
      await this.assertPlayerExists(dto.defenderId);
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
        defenderId: dto.defenderId,
        isMade: dto.isMade,
        clipInSec: dto.clipInSec,
        clipOutSec: dto.clipOutSec,
        // Never trust a client-supplied point value — always derive it server-side.
        pointValue: pointValueForActionType(dto.actionType),
        createdById: user.id,
      },
    });

    // An Admin editing a match after the Scout locked it (see ensureUnlockedAndManageable)
    // changes the tag set the original lock-triggered recompute was based on — re-run it so
    // dashboards reflect the correction instead of going stale.
    if (match.lockedAt) {
      await this.statRecomputeQueue.enqueueMatchRecompute(matchId);
    }

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
    const match = await this.ensureUnlockedAndManageable(user, tag.matchId);

    const updated = await this.prisma.actionTag.update({
      where: { id: tagId },
      data: {
        ...dto,
        // Recompute pointValue whenever actionType changes; leave it untouched otherwise.
        ...(dto.actionType ? { pointValue: pointValueForActionType(dto.actionType) } : {}),
      },
    });

    if (match.lockedAt) {
      await this.statRecomputeQueue.enqueueMatchRecompute(tag.matchId);
    }
    return updated;
  }

  async remove(user: AuthenticatedUser, tagId: string) {
    const tag = await this.findTagOrThrow(tagId);
    const match = await this.ensureUnlockedAndManageable(user, tag.matchId);
    await this.prisma.actionTag.delete({ where: { id: tagId } });

    if (match.lockedAt) {
      await this.statRecomputeQueue.enqueueMatchRecompute(tag.matchId);
    }
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
    // A Scout can no longer touch tags once locked — that's the whole point of locking, it
    // finalizes their work. Admin keeps an override to fix a Scout's mistake after the fact,
    // same spirit as Superadmin's existing override to delete a played match (see PROGRESS.md).
    if (match.lockedAt && !user.isSuperadmin) {
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

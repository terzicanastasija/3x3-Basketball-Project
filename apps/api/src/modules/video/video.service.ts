import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { VideoProcessingStatus, VideoSourceType } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../common/s3/s3.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import { RegisterVideoDto, RequestUploadUrlDto } from "@3x3/shared";

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service
  ) {}

  listForMatch(matchId: string) {
    return this.prisma.videoAsset.findMany({ where: { matchId }, orderBy: { createdAt: "asc" } });
  }

  async requestUploadUrl(user: AuthenticatedUser, matchId: string, dto: RequestUploadUrlDto) {
    await this.assertCanManageMatch(user, matchId);
    // Namespaced by matchId so keys never collide across matches; randomUUID so concurrent
    // uploads of same-named files never collide either.
    const fileKey = `matches/${matchId}/${randomUUID()}-${dto.fileName}`;
    const uploadUrl = await this.s3.getUploadUrl(fileKey, dto.contentType);
    return { fileKey, uploadUrl };
  }

  async register(user: AuthenticatedUser, matchId: string, dto: RegisterVideoDto) {
    await this.assertCanManageMatch(user, matchId);
    return this.prisma.videoAsset.create({
      data: {
        matchId,
        sourceType: dto.sourceType,
        fileKey: dto.sourceType === VideoSourceType.FILE ? dto.fileKey : null,
        externalUrl: dto.sourceType === VideoSourceType.EXTERNAL ? dto.externalUrl : null,
        durationSec: dto.durationSec,
        // No transcoding pipeline exists yet (that's Phase 5) — both source types are
        // immediately playable once registered.
        processingStatus: VideoProcessingStatus.READY,
        uploadedById: user.id,
      },
    });
  }

  async getPlaybackUrl(videoAssetId: string) {
    const video = await this.prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
    if (!video) {
      throw new NotFoundException("Video not found.");
    }
    if (video.sourceType === VideoSourceType.EXTERNAL) {
      return { url: video.externalUrl, sourceType: video.sourceType };
    }
    const url = await this.s3.getPlaybackUrl(video.fileKey!);
    return { url, sourceType: video.sourceType };
  }

  async remove(user: AuthenticatedUser, videoAssetId: string) {
    const video = await this.prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      include: { _count: { select: { actionTags: true } } },
    });
    if (!video) {
      throw new NotFoundException("Video not found.");
    }
    await this.assertCanManageMatch(user, video.matchId);
    if (video._count.actionTags > 0) {
      throw new BadRequestException("Cannot delete a video that already has tags against it.");
    }
    if (video.sourceType === VideoSourceType.FILE && video.fileKey) {
      await this.s3.deleteObject(video.fileKey);
    }
    await this.prisma.videoAsset.delete({ where: { id: videoAssetId } });
  }

  // Video upload/registration is Scout-or-Admin only, globally — not club-scoped like most
  // other write paths in this app. See Role enum's SCOUT comment for why.
  private async assertCanManageMatch(user: AuthenticatedUser, matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    if (!user.isSuperadmin && !user.isScout) {
      throw new ForbiddenException("Only a Scout or Admin can manage this match's video.");
    }
  }
}

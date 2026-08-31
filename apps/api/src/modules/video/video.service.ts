import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Role, VideoProcessingStatus, VideoSourceType } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../common/s3/s3.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { RegisterVideoDto, RequestUploadUrlDto } from "@3x3/shared";

const MANAGE_ROLES: Role[] = [Role.CLUB_ADMIN, Role.COACH];

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service
  ) {}

  listForMatch(matchId: string) {
    return this.prisma.videoAsset.findMany({ where: { matchId }, orderBy: { createdAt: "asc" } });
  }

  async requestUploadUrl(
    user: AuthenticatedUser,
    clubContext: ClubContext,
    matchId: string,
    dto: RequestUploadUrlDto
  ) {
    await this.assertCanManageMatch(user, clubContext, matchId);
    // Namespaced by matchId so keys never collide across matches; randomUUID so concurrent
    // uploads of same-named files never collide either.
    const fileKey = `matches/${matchId}/${randomUUID()}-${dto.fileName}`;
    const uploadUrl = await this.s3.getUploadUrl(fileKey, dto.contentType);
    return { fileKey, uploadUrl };
  }

  async register(user: AuthenticatedUser, clubContext: ClubContext, matchId: string, dto: RegisterVideoDto) {
    await this.assertCanManageMatch(user, clubContext, matchId);
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

  async remove(user: AuthenticatedUser, clubContext: ClubContext, videoAssetId: string) {
    const video = await this.prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      include: { _count: { select: { actionTags: true } } },
    });
    if (!video) {
      throw new NotFoundException("Video not found.");
    }
    await this.assertCanManageMatch(user, clubContext, video.matchId);
    if (video._count.actionTags > 0) {
      throw new BadRequestException("Cannot delete a video that already has tags against it.");
    }
    if (video.sourceType === VideoSourceType.FILE && video.fileKey) {
      await this.s3.deleteObject(video.fileKey);
    }
    await this.prisma.videoAsset.delete({ where: { id: videoAssetId } });
  }

  private async assertCanManageMatch(user: AuthenticatedUser, clubContext: ClubContext, matchId: string) {
    if (user.isSuperadmin) return;
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: { select: { clubId: true } }, awayTeam: { select: { clubId: true } } },
    });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    const clubIds = [match.homeTeam.clubId, match.awayTeam.clubId];
    const canManage = clubIds.some((clubId) => MANAGE_ROLES.includes(clubContext.roleByClubId[clubId]));
    if (!canManage) {
      throw new ForbiddenException("You must be a club admin or coach of the home or away team's club.");
    }
  }
}

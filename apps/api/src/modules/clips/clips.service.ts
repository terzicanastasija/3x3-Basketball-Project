import { Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus } from "@prisma/client";
import { VideoSourceType } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../common/s3/s3.service";
import { buildYoutubeDeepLink } from "./youtube-deep-link";

export type TagClipInfo =
  | { type: "NONE" }
  | { type: "DEEP_LINK"; url: string }
  | { type: "CLIP"; status: JobStatus; url?: string; errorMessage?: string | null };

@Injectable()
export class ClipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service
  ) {}

  // Shared by GET /tags/:tagId/clip and CompilationsService — one resolution path so a clip's
  // "is it ready / what's its URL" logic never drifts between the two call sites.
  async resolveTagClip(tagId: string): Promise<TagClipInfo> {
    const tag = await this.prisma.actionTag.findUnique({
      where: { id: tagId },
      include: { videoAsset: true, clipJob: true },
    });
    if (!tag) {
      throw new NotFoundException("Tag not found.");
    }
    if (!tag.videoAsset) {
      return { type: "NONE" };
    }
    if (tag.videoAsset.sourceType === VideoSourceType.EXTERNAL) {
      return { type: "DEEP_LINK", url: buildYoutubeDeepLink(tag.videoAsset.externalUrl!, tag.timestampSec) };
    }
    // FILE source
    if (!tag.clipJob) {
      // Shouldn't normally happen (TagsService always creates one for a FILE-source tag), but
      // don't crash the read path if it somehow does.
      return { type: "CLIP", status: JobStatus.QUEUED };
    }
    if (tag.clipJob.status !== JobStatus.COMPLETED) {
      return { type: "CLIP", status: tag.clipJob.status, errorMessage: tag.clipJob.errorMessage };
    }
    const url = await this.s3.getClipPlaybackUrl(tag.clipJob.outputKey!);
    return { type: "CLIP", status: JobStatus.COMPLETED, url };
  }
}

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Role, VideoSourceType } from "@3x3/shared";
import { VideoService } from "./video.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    match: { findUnique: jest.fn() },
    videoAsset: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  };
}

function makeS3Mock() {
  return {
    getUploadUrl: jest.fn().mockResolvedValue("https://minio.local/signed-put"),
    getPlaybackUrl: jest.fn().mockResolvedValue("https://minio.local/signed-get"),
    deleteObject: jest.fn(),
  };
}

const coachUser: AuthenticatedUser = { id: "user-1", email: "coach@test.local", isSuperadmin: false };
const homeClubCoachContext: ClubContext = {
  accessibleClubIds: ["club-home"],
  roleByClubId: { "club-home": Role.COACH },
};

function matchRow() {
  return { id: "match-1", homeTeam: { clubId: "club-home" }, awayTeam: { clubId: "club-away" } };
}

describe("VideoService.requestUploadUrl", () => {
  it("namespaces the generated key under the matchId so keys never collide across matches", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(matchRow());
    const s3 = makeS3Mock();
    const service = new VideoService(prisma as never, s3 as never);

    const resultA = await service.requestUploadUrl(coachUser, homeClubCoachContext, "match-1", {
      fileName: "clip.mp4",
      contentType: "video/mp4",
    });
    const resultB = await service.requestUploadUrl(coachUser, homeClubCoachContext, "match-2", {
      fileName: "clip.mp4",
      contentType: "video/mp4",
    });

    expect(resultA.fileKey.startsWith("matches/match-1/")).toBe(true);
    expect(resultA.fileKey).not.toEqual(resultB.fileKey);
  });

  it("generates distinct keys for two uploads of the same filename to the same match", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(matchRow());
    const s3 = makeS3Mock();
    const service = new VideoService(prisma as never, s3 as never);

    const first = await service.requestUploadUrl(coachUser, homeClubCoachContext, "match-1", {
      fileName: "clip.mp4",
      contentType: "video/mp4",
    });
    const second = await service.requestUploadUrl(coachUser, homeClubCoachContext, "match-1", {
      fileName: "clip.mp4",
      contentType: "video/mp4",
    });

    expect(first.fileKey).not.toEqual(second.fileKey);
  });

  it("rejects a caller with no role in either team's club", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(matchRow());
    const s3 = makeS3Mock();
    const service = new VideoService(prisma as never, s3 as never);
    const outsiderContext: ClubContext = { accessibleClubIds: ["club-other"], roleByClubId: {} };

    await expect(
      service.requestUploadUrl(coachUser, outsiderContext, "match-1", {
        fileName: "clip.mp4",
        contentType: "video/mp4",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("VideoService.remove", () => {
  it("blocks deleting a video that already has tags against it", async () => {
    const prisma = makePrismaMock();
    prisma.videoAsset.findUnique.mockResolvedValue({
      id: "video-1",
      matchId: "match-1",
      sourceType: VideoSourceType.FILE,
      fileKey: "matches/match-1/abc-clip.mp4",
      _count: { actionTags: 3 },
    });
    prisma.match.findUnique.mockResolvedValue(matchRow());
    const s3 = makeS3Mock();
    const service = new VideoService(prisma as never, s3 as never);

    await expect(service.remove(coachUser, homeClubCoachContext, "video-1")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
    expect(s3.deleteObject).not.toHaveBeenCalled();
  });

  it("deletes the S3 object and the row when a FILE video has no tags", async () => {
    const prisma = makePrismaMock();
    prisma.videoAsset.findUnique.mockResolvedValue({
      id: "video-1",
      matchId: "match-1",
      sourceType: VideoSourceType.FILE,
      fileKey: "matches/match-1/abc-clip.mp4",
      _count: { actionTags: 0 },
    });
    prisma.match.findUnique.mockResolvedValue(matchRow());
    const s3 = makeS3Mock();
    const service = new VideoService(prisma as never, s3 as never);

    await service.remove(coachUser, homeClubCoachContext, "video-1");

    expect(s3.deleteObject).toHaveBeenCalledWith("matches/match-1/abc-clip.mp4");
    expect(prisma.videoAsset.delete).toHaveBeenCalledWith({ where: { id: "video-1" } });
  });
});

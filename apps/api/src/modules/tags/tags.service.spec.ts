import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ActionType, VideoSourceType } from "@3x3/shared";
import { TagsService } from "./tags.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    actionTag: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    match: { findUnique: jest.fn(), update: jest.fn() },
    videoAsset: { findUnique: jest.fn() },
    clipJob: { create: jest.fn() },
  };
}

function makeQueueMock() {
  return { enqueueMatchRecompute: jest.fn() };
}

function makeClipQueueMock() {
  return { enqueueClipGeneration: jest.fn() };
}

const scoutUser: AuthenticatedUser = { id: "user-1", email: "scout@test.local", isSuperadmin: false, isScout: true };
const coachUser: AuthenticatedUser = { id: "user-2", email: "coach@test.local", isSuperadmin: false, isScout: false };

function unlockedMatch() {
  return { id: "match-1", homeTeamId: "team-home", awayTeamId: "team-away", lockedAt: null };
}

function lockedMatch() {
  return { ...unlockedMatch(), lockedAt: new Date("2026-01-01") };
}

describe("TagsService.listForMatch", () => {
  it("includes player/relatedPlayer names — the tag list is the only place a viewer can tell which player a clip belongs to", () => {
    const prisma = makePrismaMock();
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    service.listForMatch("match-1");

    expect(prisma.actionTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          player: { select: { id: true, firstName: true, lastName: true } },
          relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    );
  });
});

describe("TagsService.create", () => {
  it("derives pointValue from actionType server-side, ignoring any client-supplied value", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.create.mockResolvedValue({ id: "tag-1" });
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await service.create(scoutUser, "match-1", {
      timestampSec: 12.5,
      actionType: ActionType.SHOT_2PT_MADE,
      teamId: "team-home",
      // @ts-expect-error deliberately simulating a malicious/buggy client payload
      pointValue: 99,
    });

    expect(prisma.actionTag.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pointValue: 2 }) })
    );
  });

  it("stores a null pointValue for non-shot action types", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.create.mockResolvedValue({ id: "tag-1" });
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await service.create(scoutUser, "match-1", {
      timestampSec: 5,
      actionType: ActionType.STEAL,
      teamId: "team-home",
    });

    expect(prisma.actionTag.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pointValue: null }) })
    );
  });

  it("rejects a teamId that isn't the match's home or away team", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(
      service.create(scoutUser, "match-1", {
        timestampSec: 5,
        actionType: ActionType.STEAL,
        teamId: "some-other-team",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects creating a tag once the match is locked", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(lockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(
      service.create(scoutUser, "match-1", {
        timestampSec: 5,
        actionType: ActionType.STEAL,
        teamId: "team-home",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.actionTag.create).not.toHaveBeenCalled();
  });

  it("rejects a Coach — tagging is Scout-or-Admin only, not club-scoped like Coach's other permissions", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(
      service.create(coachUser, "match-1", {
        timestampSec: 5,
        actionType: ActionType.STEAL,
        teamId: "team-home",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates a ClipJob and enqueues clip generation for a FILE-source tag", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.create.mockResolvedValue({ id: "tag-1" });
    prisma.videoAsset.findUnique.mockResolvedValue({ sourceType: VideoSourceType.FILE });
    const clipQueue = makeClipQueueMock();
    const service = new TagsService(prisma as never, makeQueueMock() as never, clipQueue as never);

    await service.create(scoutUser, "match-1", {
      timestampSec: 5,
      actionType: ActionType.SHOT_2PT_MADE,
      teamId: "team-home",
      videoAssetId: "video-1",
    });

    expect(prisma.clipJob.create).toHaveBeenCalledWith({ data: { actionTagId: "tag-1" } });
    expect(clipQueue.enqueueClipGeneration).toHaveBeenCalledWith("tag-1");
  });

  it("never creates a ClipJob for an EXTERNAL-source (YouTube) tag", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.create.mockResolvedValue({ id: "tag-1" });
    prisma.videoAsset.findUnique.mockResolvedValue({ sourceType: VideoSourceType.EXTERNAL });
    const clipQueue = makeClipQueueMock();
    const service = new TagsService(prisma as never, makeQueueMock() as never, clipQueue as never);

    await service.create(scoutUser, "match-1", {
      timestampSec: 5,
      actionType: ActionType.SHOT_2PT_MADE,
      teamId: "team-home",
      videoAssetId: "video-1",
    });

    expect(prisma.clipJob.create).not.toHaveBeenCalled();
    expect(clipQueue.enqueueClipGeneration).not.toHaveBeenCalled();
  });

  it("never creates a ClipJob when the tag has no videoAssetId at all", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.create.mockResolvedValue({ id: "tag-1" });
    const clipQueue = makeClipQueueMock();
    const service = new TagsService(prisma as never, makeQueueMock() as never, clipQueue as never);

    await service.create(scoutUser, "match-1", {
      timestampSec: 5,
      actionType: ActionType.STEAL,
      teamId: "team-home",
    });

    expect(prisma.videoAsset.findUnique).not.toHaveBeenCalled();
    expect(prisma.clipJob.create).not.toHaveBeenCalled();
    expect(clipQueue.enqueueClipGeneration).not.toHaveBeenCalled();
  });
});

describe("TagsService.update / remove", () => {
  it("rejects updating a tag once its match is locked", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(lockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(service.update(scoutUser, "tag-1", { timestampSec: 10 })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.actionTag.update).not.toHaveBeenCalled();
  });

  it("rejects deleting a tag once its match is locked", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(lockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(service.remove(scoutUser, "tag-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.actionTag.delete).not.toHaveBeenCalled();
  });

  it("allows editing and deleting a tag pre-lock", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.update.mockResolvedValue({ id: "tag-1" });
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await service.update(scoutUser, "tag-1", { timestampSec: 10 });
    await service.remove(scoutUser, "tag-1");

    expect(prisma.actionTag.update).toHaveBeenCalled();
    expect(prisma.actionTag.delete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });

  it("rejects a Coach editing or deleting a tag", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(service.update(coachUser, "tag-1", { timestampSec: 10 })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.remove(coachUser, "tag-1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("TagsService.lockMatch", () => {
  it("sets lockedAt on an unlocked match and enqueues a stat-recompute job", async () => {
    const prisma = makePrismaMock();
    const queue = makeQueueMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.match.update.mockResolvedValue({ id: "match-1", lockedAt: new Date() });
    const service = new TagsService(prisma as never, queue as never, makeClipQueueMock() as never);

    await service.lockMatch(scoutUser, "match-1");

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: { lockedAt: expect.any(Date) },
    });
    expect(queue.enqueueMatchRecompute).toHaveBeenCalledWith("match-1");
  });

  it("is idempotent — locking an already-locked match does not throw, re-update, or re-enqueue", async () => {
    const prisma = makePrismaMock();
    const queue = makeQueueMock();
    const already = lockedMatch();
    prisma.match.findUnique.mockResolvedValue(already);
    const service = new TagsService(prisma as never, queue as never, makeClipQueueMock() as never);

    const result = await service.lockMatch(scoutUser, "match-1");

    expect(result).toBe(already);
    expect(prisma.match.update).not.toHaveBeenCalled();
    expect(queue.enqueueMatchRecompute).not.toHaveBeenCalled();
  });

  it("rejects a Coach locking a match", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    const service = new TagsService(prisma as never, makeQueueMock() as never, makeClipQueueMock() as never);

    await expect(service.lockMatch(coachUser, "match-1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

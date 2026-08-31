import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ActionType, Role } from "@3x3/shared";
import { TagsService } from "./tags.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    actionTag: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    match: { findUnique: jest.fn(), update: jest.fn() },
  };
}

const coachUser: AuthenticatedUser = { id: "user-1", email: "coach@test.local", isSuperadmin: false };
const homeClubCoachContext: ClubContext = {
  accessibleClubIds: ["club-home"],
  roleByClubId: { "club-home": Role.COACH },
};

function unlockedMatch() {
  return {
    id: "match-1",
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    lockedAt: null,
    homeTeam: { clubId: "club-home" },
    awayTeam: { clubId: "club-away" },
  };
}

function lockedMatch() {
  return { ...unlockedMatch(), lockedAt: new Date("2026-01-01") };
}

describe("TagsService.create", () => {
  it("derives pointValue from actionType server-side, ignoring any client-supplied value", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.create.mockResolvedValue({ id: "tag-1" });
    const service = new TagsService(prisma as never);

    await service.create(coachUser, homeClubCoachContext, "match-1", {
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
    const service = new TagsService(prisma as never);

    await service.create(coachUser, homeClubCoachContext, "match-1", {
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
    const service = new TagsService(prisma as never);

    await expect(
      service.create(coachUser, homeClubCoachContext, "match-1", {
        timestampSec: 5,
        actionType: ActionType.STEAL,
        teamId: "some-other-team",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects creating a tag once the match is locked", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(lockedMatch());
    const service = new TagsService(prisma as never);

    await expect(
      service.create(coachUser, homeClubCoachContext, "match-1", {
        timestampSec: 5,
        actionType: ActionType.STEAL,
        teamId: "team-home",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.actionTag.create).not.toHaveBeenCalled();
  });

  it("rejects a caller with no role in either team's club", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    const service = new TagsService(prisma as never);
    const outsiderContext: ClubContext = { accessibleClubIds: ["club-other"], roleByClubId: {} };

    await expect(
      service.create(coachUser, outsiderContext, "match-1", {
        timestampSec: 5,
        actionType: ActionType.STEAL,
        teamId: "team-home",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("TagsService.update / remove", () => {
  it("rejects updating a tag once its match is locked", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(lockedMatch());
    const service = new TagsService(prisma as never);

    await expect(
      service.update(coachUser, homeClubCoachContext, "tag-1", { timestampSec: 10 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.actionTag.update).not.toHaveBeenCalled();
  });

  it("rejects deleting a tag once its match is locked", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(lockedMatch());
    const service = new TagsService(prisma as never);

    await expect(service.remove(coachUser, homeClubCoachContext, "tag-1")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.actionTag.delete).not.toHaveBeenCalled();
  });

  it("allows editing and deleting a tag pre-lock", async () => {
    const prisma = makePrismaMock();
    prisma.actionTag.findUnique.mockResolvedValue({ id: "tag-1", matchId: "match-1" });
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.actionTag.update.mockResolvedValue({ id: "tag-1" });
    const service = new TagsService(prisma as never);

    await service.update(coachUser, homeClubCoachContext, "tag-1", { timestampSec: 10 });
    await service.remove(coachUser, homeClubCoachContext, "tag-1");

    expect(prisma.actionTag.update).toHaveBeenCalled();
    expect(prisma.actionTag.delete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });
});

describe("TagsService.lockMatch", () => {
  it("sets lockedAt on an unlocked match", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue(unlockedMatch());
    prisma.match.update.mockResolvedValue({ id: "match-1", lockedAt: new Date() });
    const service = new TagsService(prisma as never);

    await service.lockMatch(coachUser, homeClubCoachContext, "match-1");

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: { lockedAt: expect.any(Date) },
    });
  });

  it("is idempotent — locking an already-locked match does not throw or re-update", async () => {
    const prisma = makePrismaMock();
    const already = lockedMatch();
    prisma.match.findUnique.mockResolvedValue(already);
    const service = new TagsService(prisma as never);

    const result = await service.lockMatch(coachUser, homeClubCoachContext, "match-1");

    expect(result).toBe(already);
    expect(prisma.match.update).not.toHaveBeenCalled();
  });
});

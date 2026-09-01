import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MatchStatus } from "@3x3/shared";
import { MatchesService } from "./matches.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    team: { findUnique: jest.fn() },
    match: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
}

const coachUser: AuthenticatedUser = { id: "user-1", email: "coach@test.local", isSuperadmin: false, isScout: false };
const superadminUser: AuthenticatedUser = { id: "user-2", email: "admin@test.local", isSuperadmin: true, isScout: false };

describe("MatchesService.create", () => {
  it("allows an Admin to schedule a match", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValueOnce({ id: "team-home" }).mockResolvedValueOnce({ id: "team-away" });
    prisma.match.create.mockResolvedValue({ id: "match-1" });
    const service = new MatchesService(prisma as never);

    await service.create(superadminUser, "tourn-1", {
      homeTeamId: "team-home",
      awayTeamId: "team-away",
    });

    expect(prisma.match.create).toHaveBeenCalled();
  });

  it("rejects a non-Admin (e.g. a club admin or coach) — match management is Admin-only", async () => {
    const prisma = makePrismaMock();
    const service = new MatchesService(prisma as never);

    await expect(
      service.create(coachUser, "tourn-1", {
        homeTeamId: "team-home",
        awayTeamId: "team-away",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when either team does not exist", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "team-away" });
    const service = new MatchesService(prisma as never);

    await expect(
      service.create(superadminUser, "tourn-1", {
        homeTeamId: "missing",
        awayTeamId: "team-away",
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("MatchesService.recordResult", () => {
  it("sets status to PLAYED and stores the score/foul/end-type fields", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({ id: "match-1", status: MatchStatus.SCHEDULED });
    prisma.match.update.mockResolvedValue({ id: "match-1", status: MatchStatus.PLAYED });
    const service = new MatchesService(prisma as never);

    await service.recordResult(superadminUser, "match-1", {
      homeScore: 21,
      awayScore: 18,
      endType: "REGULAR_TIME" as never,
      homeTeamFouls: 4,
      awayTeamFouls: 6,
    });

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: {
        homeScore: 21,
        awayScore: 18,
        endType: "REGULAR_TIME",
        homeTeamFouls: 4,
        awayTeamFouls: 6,
        status: MatchStatus.PLAYED,
      },
    });
  });

  it("rejects a non-Admin recording a result", async () => {
    const prisma = makePrismaMock();
    const service = new MatchesService(prisma as never);

    await expect(
      service.recordResult(coachUser, "match-1", {
        homeScore: 21,
        awayScore: 18,
        endType: "REGULAR_TIME" as never,
        homeTeamFouls: 4,
        awayTeamFouls: 6,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.match.findUnique).not.toHaveBeenCalled();
  });
});

describe("MatchesService.remove", () => {
  it("allows an Admin to delete a PLAYED match (override retained from before the RBAC overhaul)", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({ id: "match-1", status: MatchStatus.PLAYED });
    const service = new MatchesService(prisma as never);

    await service.remove(superadminUser, "match-1");

    expect(prisma.match.delete).toHaveBeenCalledWith({ where: { id: "match-1" } });
  });

  it("allows an Admin to delete a non-PLAYED match", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({ id: "match-1", status: MatchStatus.SCHEDULED });
    const service = new MatchesService(prisma as never);

    await service.remove(superadminUser, "match-1");

    expect(prisma.match.delete).toHaveBeenCalledWith({ where: { id: "match-1" } });
  });

  it("rejects a non-Admin deleting any match", async () => {
    const prisma = makePrismaMock();
    const service = new MatchesService(prisma as never);

    await expect(service.remove(coachUser, "match-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.match.delete).not.toHaveBeenCalled();
  });
});

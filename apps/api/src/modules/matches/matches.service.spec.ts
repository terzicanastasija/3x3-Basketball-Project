import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MatchStatus, Role } from "@3x3/shared";
import { MatchesService } from "./matches.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    team: { findUnique: jest.fn() },
    match: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
}

const coachUser: AuthenticatedUser = { id: "user-1", email: "coach@test.local", isSuperadmin: false };
const superadminUser: AuthenticatedUser = { id: "user-2", email: "admin@test.local", isSuperadmin: true };

const homeClubCoachContext: ClubContext = {
  accessibleClubIds: ["club-home"],
  roleByClubId: { "club-home": Role.COACH },
};
const outsiderContext: ClubContext = { accessibleClubIds: ["club-other"], roleByClubId: { "club-other": Role.COACH } };

describe("MatchesService.create", () => {
  it("allows a coach of the home team's club to schedule a match", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique
      .mockResolvedValueOnce({ clubId: "club-home" })
      .mockResolvedValueOnce({ clubId: "club-away" });
    prisma.match.create.mockResolvedValue({ id: "match-1" });
    const service = new MatchesService(prisma as never);

    await service.create(coachUser, homeClubCoachContext, "tourn-1", {
      homeTeamId: "team-home",
      awayTeamId: "team-away",
    });

    expect(prisma.match.create).toHaveBeenCalled();
  });

  it("allows a coach of the away team's club too (either side may schedule)", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique
      .mockResolvedValueOnce({ clubId: "club-other-home" })
      .mockResolvedValueOnce({ clubId: "club-home" });
    prisma.match.create.mockResolvedValue({ id: "match-1" });
    const service = new MatchesService(prisma as never);

    await service.create(coachUser, homeClubCoachContext, "tourn-1", {
      homeTeamId: "team-other",
      awayTeamId: "team-home",
    });

    expect(prisma.match.create).toHaveBeenCalled();
  });

  it("rejects a caller with no role in either team's club", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique
      .mockResolvedValueOnce({ clubId: "club-home" })
      .mockResolvedValueOnce({ clubId: "club-away" });
    const service = new MatchesService(prisma as never);

    await expect(
      service.create(coachUser, outsiderContext, "tourn-1", {
        homeTeamId: "team-home",
        awayTeamId: "team-away",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws NotFoundException when either team does not exist", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ clubId: "club-away" });
    const service = new MatchesService(prisma as never);

    await expect(
      service.create(coachUser, homeClubCoachContext, "tourn-1", {
        homeTeamId: "missing",
        awayTeamId: "team-away",
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("MatchesService.recordResult", () => {
  it("sets status to PLAYED and stores the score/foul/end-type fields", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.SCHEDULED,
      homeTeam: { clubId: "club-home" },
      awayTeam: { clubId: "club-away" },
    });
    prisma.match.update.mockResolvedValue({ id: "match-1", status: MatchStatus.PLAYED });
    const service = new MatchesService(prisma as never);

    await service.recordResult(coachUser, homeClubCoachContext, "match-1", {
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
});

describe("MatchesService.remove", () => {
  it("blocks deleting a PLAYED match for a non-superadmin", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.PLAYED,
      homeTeam: { clubId: "club-home" },
      awayTeam: { clubId: "club-away" },
    });
    const service = new MatchesService(prisma as never);

    await expect(service.remove(coachUser, homeClubCoachContext, "match-1")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.match.delete).not.toHaveBeenCalled();
  });

  it("allows a superadmin to delete a PLAYED match", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.PLAYED,
      homeTeam: { clubId: "club-home" },
      awayTeam: { clubId: "club-away" },
    });
    const service = new MatchesService(prisma as never);

    await service.remove(superadminUser, { accessibleClubIds: "ALL", roleByClubId: {} }, "match-1");

    expect(prisma.match.delete).toHaveBeenCalledWith({ where: { id: "match-1" } });
  });

  it("allows deleting a non-PLAYED match for an authorized coach", async () => {
    const prisma = makePrismaMock();
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: MatchStatus.SCHEDULED,
      homeTeam: { clubId: "club-home" },
      awayTeam: { clubId: "club-away" },
    });
    const service = new MatchesService(prisma as never);

    await service.remove(coachUser, homeClubCoachContext, "match-1");

    expect(prisma.match.delete).toHaveBeenCalledWith({ where: { id: "match-1" } });
  });
});

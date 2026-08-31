import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Role } from "@3x3/shared";
import { RostersService } from "./rosters.service";
import { ClubContext } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    team: { findUnique: jest.fn() },
    roster: { findUnique: jest.fn(), create: jest.fn() },
    rosterPlayer: { upsert: jest.fn(), delete: jest.fn() },
  };
}

const coachContext: ClubContext = {
  accessibleClubIds: ["club-1"],
  roleByClubId: { "club-1": Role.COACH },
};

describe("RostersService.createOrGet", () => {
  it("returns the existing roster without creating a new one when it already exists", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ clubId: "club-1" });
    const existing = { id: "roster-1", teamId: "team-1", tournamentId: "tourn-1", players: [] };
    prisma.roster.findUnique.mockResolvedValue(existing);
    const service = new RostersService(prisma as never);

    const result = await service.createOrGet("team-1", "tourn-1", coachContext);

    expect(result).toBe(existing);
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });

  it("creates a roster when none exists yet for the team+tournament pair", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ clubId: "club-1" });
    prisma.roster.findUnique.mockResolvedValue(null);
    const created = { id: "roster-2", teamId: "team-1", tournamentId: "tourn-1", players: [] };
    prisma.roster.create.mockResolvedValue(created);
    const service = new RostersService(prisma as never);

    const result = await service.createOrGet("team-1", "tourn-1", coachContext);

    expect(result).toBe(created);
    expect(prisma.roster.create).toHaveBeenCalledWith({
      data: { teamId: "team-1", tournamentId: "tourn-1" },
      include: { players: true },
    });
  });

  it("rejects a caller who is not CLUB_ADMIN/COACH of the team's club", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ clubId: "club-1" });
    const service = new RostersService(prisma as never);
    const outsiderContext: ClubContext = { accessibleClubIds: ["club-2"], roleByClubId: {} };

    await expect(service.createOrGet("team-1", "tourn-1", outsiderContext)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("throws NotFoundException when the team does not exist", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue(null);
    const service = new RostersService(prisma as never);

    await expect(service.createOrGet("missing-team", "tourn-1", coachContext)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

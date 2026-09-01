import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RostersService } from "./rosters.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    team: { findUnique: jest.fn() },
    roster: { findUnique: jest.fn(), create: jest.fn() },
    rosterPlayer: { upsert: jest.fn(), delete: jest.fn() },
  };
}

const superadminUser: AuthenticatedUser = { id: "u1", email: "admin@test.local", isSuperadmin: true, isScout: false };
const scoutUser: AuthenticatedUser = { id: "u2", email: "scout@test.local", isSuperadmin: false, isScout: true };
const coachUser: AuthenticatedUser = { id: "u3", email: "coach@test.local", isSuperadmin: false, isScout: false };

// Scouts get the same "ALL" read-scope sentinel as Superadmin (see ClubScopeGuard) — this
// context is what a Scout's request would actually carry, distinct from the user flags above.
const scoutOrSuperadminContext: ClubContext = { accessibleClubIds: "ALL", roleByClubId: {} };
const coachContext: ClubContext = { accessibleClubIds: ["club-1"], roleByClubId: { "club-1": "COACH" as never } };

describe("RostersService.createOrGet", () => {
  it("returns the existing roster without creating a new one when it already exists", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "team-1" });
    const existing = { id: "roster-1", teamId: "team-1", tournamentId: "tourn-1", players: [] };
    prisma.roster.findUnique.mockResolvedValue(existing);
    const service = new RostersService(prisma as never);

    const result = await service.createOrGet(superadminUser, "team-1", "tourn-1");

    expect(result).toBe(existing);
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });

  it("creates a roster when none exists yet for the team+tournament pair", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "team-1" });
    prisma.roster.findUnique.mockResolvedValue(null);
    const created = { id: "roster-2", teamId: "team-1", tournamentId: "tourn-1", players: [] };
    prisma.roster.create.mockResolvedValue(created);
    const service = new RostersService(prisma as never);

    const result = await service.createOrGet(superadminUser, "team-1", "tourn-1");

    expect(result).toBe(created);
    expect(prisma.roster.create).toHaveBeenCalledWith({
      data: { teamId: "team-1", tournamentId: "tourn-1" },
      include: { players: true },
    });
  });

  it("rejects a Coach — roster management is Admin-only now, not club-scoped CLUB_ADMIN/COACH", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "team-1" });
    const service = new RostersService(prisma as never);

    await expect(service.createOrGet(coachUser, "team-1", "tourn-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("rejects a Scout — reading any club's roster does not imply roster-write access", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "team-1" });
    const service = new RostersService(prisma as never);

    await expect(service.createOrGet(scoutUser, "team-1", "tourn-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the team does not exist", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue(null);
    const service = new RostersService(prisma as never);

    await expect(service.createOrGet(superadminUser, "missing-team", "tourn-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe("RostersService.find (read)", () => {
  it("allows a Coach to view a roster in their own club — reads stay open, unlike writes", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ clubId: "club-1" });
    prisma.roster.findUnique.mockResolvedValue({ id: "roster-1", players: [] });
    const service = new RostersService(prisma as never);

    await expect(service.find("team-1", "tourn-1", coachContext)).resolves.toBeDefined();
  });

  it("rejects viewing a roster for a club the caller has no access to", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ clubId: "club-2" });
    const service = new RostersService(prisma as never);

    await expect(service.find("team-1", "tourn-1", coachContext)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows a Scout to view any club's roster — this is the fix for 'can't select a player while tagging'", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ clubId: "club-1" });
    prisma.roster.findUnique.mockResolvedValue({ id: "roster-1", players: [] });
    const service = new RostersService(prisma as never);

    await expect(service.find("team-1", "tourn-1", scoutOrSuperadminContext)).resolves.toBeDefined();
  });
});

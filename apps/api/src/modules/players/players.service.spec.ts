import { ForbiddenException } from "@nestjs/common";
import { PlayersService } from "./players.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    player: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

const superadminUser: AuthenticatedUser = { id: "u1", email: "admin@test.local", isSuperadmin: true, isScout: false };
const clubAdminUser: AuthenticatedUser = { id: "u2", email: "clubadmin@test.local", isSuperadmin: false, isScout: false };
const scoutUser: AuthenticatedUser = { id: "u3", email: "scout@test.local", isSuperadmin: false, isScout: true };

describe("PlayersService.search", () => {
  it("builds no dateOfBirth filter when no age bounds are given", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await service.search({});

    const where = prisma.player.findMany.mock.calls[0][0].where;
    expect(where.dateOfBirth).toBeUndefined();
  });

  it("translates minAge into a dateOfBirth <= cutoff filter", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await service.search({ minAge: 18 });

    const where = prisma.player.findMany.mock.calls[0][0].where;
    expect(where.dateOfBirth.lte).toBeInstanceOf(Date);
    expect(where.dateOfBirth.gt).toBeUndefined();
    const yearsAgo = (Date.now() - where.dateOfBirth.lte.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    expect(yearsAgo).toBeCloseTo(18, 0);
  });

  it("translates maxAge into a dateOfBirth > cutoff filter (exclusive at maxAge+1)", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await service.search({ maxAge: 21 });

    const where = prisma.player.findMany.mock.calls[0][0].where;
    expect(where.dateOfBirth.gt).toBeInstanceOf(Date);
    const yearsAgo = (Date.now() - where.dateOfBirth.gt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    expect(yearsAgo).toBeCloseTo(22, 0);
  });

  it("combines clubId, city, and both age bounds", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await service.search({ clubId: "club-1", city: "Beograd", minAge: 16, maxAge: 18 });

    const where = prisma.player.findMany.mock.calls[0][0].where;
    expect(where.homeClubId).toBe("club-1");
    expect(where.homeClub).toEqual({ city: { contains: "Beograd", mode: "insensitive" } });
    expect(where.dateOfBirth.lte).toBeInstanceOf(Date);
    expect(where.dateOfBirth.gt).toBeInstanceOf(Date);
  });
});

describe("PlayersService.create / update / remove", () => {
  it("allows an Admin to create a player record", async () => {
    const prisma = makePrismaMock();
    prisma.player.create.mockResolvedValue({ id: "player-1" });
    const service = new PlayersService(prisma as never);

    await service.create(superadminUser, { firstName: "Nikola", lastName: "Test", homeClubId: "club-1" });

    expect(prisma.player.create).toHaveBeenCalled();
  });

  it("rejects a CLUB_ADMIN creating a player — player-record management is Admin-only now", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await expect(
      service.create(clubAdminUser, { firstName: "Nikola", lastName: "Test", homeClubId: "club-1" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.player.create).not.toHaveBeenCalled();
  });

  it("rejects a CLUB_ADMIN updating or deleting a player record", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await expect(service.update(clubAdminUser, "player-1", { firstName: "X" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.remove(clubAdminUser, "player-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.player.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a Scout — reading any club's player data does not imply player-record write access", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await expect(
      service.create(scoutUser, { firstName: "Nikola", lastName: "Test", homeClubId: "club-1" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.player.create).not.toHaveBeenCalled();
  });
});

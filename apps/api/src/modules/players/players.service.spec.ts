import { ForbiddenException } from "@nestjs/common";
import { PlayersService } from "./players.service";
import { ClubContext } from "../../common/types/authenticated-request";

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

const superadminContext: ClubContext = { accessibleClubIds: "ALL", roleByClubId: {} };
const clubAdminContext: ClubContext = {
  accessibleClubIds: ["club-1"],
  roleByClubId: { "club-1": "CLUB_ADMIN" as never },
};

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

    await service.create({ firstName: "Nikola", lastName: "Test", homeClubId: "club-1" }, superadminContext);

    expect(prisma.player.create).toHaveBeenCalled();
  });

  it("rejects a CLUB_ADMIN creating a player — player-record management is Admin-only now", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await expect(
      service.create({ firstName: "Nikola", lastName: "Test", homeClubId: "club-1" }, clubAdminContext)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.player.create).not.toHaveBeenCalled();
  });

  it("rejects a CLUB_ADMIN updating or deleting a player record", async () => {
    const prisma = makePrismaMock();
    const service = new PlayersService(prisma as never);

    await expect(service.update("player-1", { firstName: "X" }, clubAdminContext)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.remove("player-1", clubAdminContext)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.player.findUnique).not.toHaveBeenCalled();
  });
});

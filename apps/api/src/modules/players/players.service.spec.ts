import { PlayersService } from "./players.service";

function makePrismaMock() {
  return {
    player: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

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

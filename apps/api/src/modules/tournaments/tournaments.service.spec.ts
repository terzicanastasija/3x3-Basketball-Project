import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { TournamentsService } from "./tournaments.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return {
    tournament: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
}

const superadminUser: AuthenticatedUser = { id: "user-1", email: "admin@test.local", isSuperadmin: true, isScout: false };
const clubAdminUser: AuthenticatedUser = { id: "user-2", email: "clubadmin@test.local", isSuperadmin: false, isScout: false };

describe("TournamentsService.create", () => {
  it("allows an Admin to create a tournament", async () => {
    const prisma = makePrismaMock();
    prisma.tournament.create.mockResolvedValue({ id: "t-1" });
    const service = new TournamentsService(prisma as never);

    await service.create(superadminUser, {
      name: "Cup",
      startDate: new Date(),
      format: "GROUP_STAGE" as never,
      clubId: "club-1",
    });

    expect(prisma.tournament.create).toHaveBeenCalled();
  });

  it("allows an Admin to create a clubless (multi-club) tournament", async () => {
    const prisma = makePrismaMock();
    prisma.tournament.create.mockResolvedValue({ id: "t-1" });
    const service = new TournamentsService(prisma as never);

    await service.create(superadminUser, {
      name: "Open Cup",
      startDate: new Date(),
      format: "GROUP_STAGE" as never,
    });

    expect(prisma.tournament.create).toHaveBeenCalled();
  });

  it("rejects a non-Admin (e.g. a club admin) — tournament management is Admin-only now", async () => {
    const prisma = makePrismaMock();
    const service = new TournamentsService(prisma as never);

    await expect(
      service.create(clubAdminUser, {
        name: "Cup",
        startDate: new Date(),
        format: "GROUP_STAGE" as never,
        clubId: "club-1",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tournament.create).not.toHaveBeenCalled();
  });
});

describe("TournamentsService.update / remove", () => {
  it("allows an Admin to update a tournament", async () => {
    const prisma = makePrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "t-1" });
    prisma.tournament.update.mockResolvedValue({ id: "t-1" });
    const service = new TournamentsService(prisma as never);

    await service.update(superadminUser, "t-1", { name: "Renamed" });

    expect(prisma.tournament.update).toHaveBeenCalled();
  });

  it("rejects a non-Admin updating or deleting a tournament", async () => {
    const prisma = makePrismaMock();
    const service = new TournamentsService(prisma as never);

    await expect(service.update(clubAdminUser, "t-1", { name: "Renamed" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.remove(clubAdminUser, "t-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tournament.findUnique).not.toHaveBeenCalled();
  });

  it("throws NotFoundException for an Admin editing a nonexistent tournament", async () => {
    const prisma = makePrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(null);
    const service = new TournamentsService(prisma as never);

    await expect(service.update(superadminUser, "missing", { name: "x" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

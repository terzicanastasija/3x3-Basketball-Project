import { ForbiddenException } from "@nestjs/common";
import { Role } from "@3x3/shared";
import { TournamentsService } from "./tournaments.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";

function makePrismaMock() {
  return { tournament: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() } };
}

const clubAdminUser: AuthenticatedUser = { id: "user-1", email: "admin@test.local", isSuperadmin: false };
const clubAdminContext: ClubContext = { accessibleClubIds: ["club-1"], roleByClubId: { "club-1": Role.CLUB_ADMIN } };
const coachOnlyContext: ClubContext = { accessibleClubIds: ["club-1"], roleByClubId: { "club-1": Role.COACH } };

describe("TournamentsService.create", () => {
  it("allows a CLUB_ADMIN to create a tournament for their own club", async () => {
    const prisma = makePrismaMock();
    prisma.tournament.create.mockResolvedValue({ id: "t-1" });
    const service = new TournamentsService(prisma as never);

    await service.create(clubAdminUser, clubAdminContext, {
      name: "Cup",
      startDate: new Date(),
      format: "GROUP_STAGE" as never,
      clubId: "club-1",
    });

    expect(prisma.tournament.create).toHaveBeenCalled();
  });

  it("rejects a caller who is only COACH (not CLUB_ADMIN) of the organizing club", async () => {
    const prisma = makePrismaMock();
    const service = new TournamentsService(prisma as never);

    await expect(
      service.create(clubAdminUser, coachOnlyContext, {
        name: "Cup",
        startDate: new Date(),
        format: "GROUP_STAGE" as never,
        clubId: "club-1",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows a CLUB_ADMIN of any club to create a clubless (multi-club) tournament", async () => {
    const prisma = makePrismaMock();
    prisma.tournament.create.mockResolvedValue({ id: "t-1" });
    const service = new TournamentsService(prisma as never);

    await service.create(clubAdminUser, clubAdminContext, {
      name: "Open Cup",
      startDate: new Date(),
      format: "GROUP_STAGE" as never,
    });

    expect(prisma.tournament.create).toHaveBeenCalled();
  });

  it("rejects a caller with no CLUB_ADMIN role anywhere from creating a clubless tournament", async () => {
    const prisma = makePrismaMock();
    const service = new TournamentsService(prisma as never);

    await expect(
      service.create(clubAdminUser, coachOnlyContext, {
        name: "Open Cup",
        startDate: new Date(),
        format: "GROUP_STAGE" as never,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

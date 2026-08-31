import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Phase-1 placeholder: just enough to populate a tournament picker for the roster builder.
// Full Tournament CRUD (create/update/format/matches) lands in Phase 2.
@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tournament.findMany({
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    });
  }
}

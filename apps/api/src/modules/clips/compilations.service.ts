import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateCompilationDto } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import { ClipsService } from "./clips.service";

@Injectable()
export class CompilationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clipsService: ClipsService
  ) {}

  // Tags are open-read (any authenticated user can already see them), so createdById is just
  // the creator for attribution — not an access-control boundary. Anyone can build a
  // compilation out of tags they can already see.
  create(user: AuthenticatedUser, dto: CreateCompilationDto) {
    return this.prisma.$transaction(async (tx) => {
      const compilation = await tx.compilation.create({
        data: { title: dto.title, createdById: user.id },
      });
      await tx.compilationItem.createMany({
        data: dto.actionTagIds.map((actionTagId, index) => ({
          compilationId: compilation.id,
          actionTagId,
          order: index,
        })),
      });
      return compilation;
    });
  }

  async findOne(id: string) {
    const compilation = await this.prisma.compilation.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            actionTag: {
              select: { id: true, actionType: true, timestampSec: true, matchId: true, playerId: true },
            },
          },
        },
      },
    });
    if (!compilation) {
      throw new NotFoundException("Compilation not found.");
    }
    const items = await Promise.all(
      compilation.items.map(async (item) => ({
        ...item,
        clip: await this.clipsService.resolveTagClip(item.actionTagId),
      }))
    );
    return { ...compilation, items };
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.compilation.findMany({
      where: user.isSuperadmin ? {} : { createdById: user.id },
      orderBy: { createdAt: "desc" },
    });
  }
}

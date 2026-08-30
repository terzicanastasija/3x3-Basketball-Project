import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuperadmin: true,
        locale: true,
        memberships: {
          select: { clubId: true, role: true, club: { select: { name: true } } },
        },
      },
    });
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return user;
  }
}

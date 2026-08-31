import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "@nestjs/config";
import { Env } from "../../config/env.validation";
import { ClubContext } from "../../common/types/authenticated-request";
import { CreateClubDto, CreateInviteDto, UpdateClubDto } from "@3x3/shared";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<Env, true>
  ) {}

  async list(clubContext: ClubContext) {
    if (clubContext.accessibleClubIds === "ALL") {
      return this.prisma.club.findMany({ orderBy: { name: "asc" } });
    }
    return this.prisma.club.findMany({
      where: { id: { in: clubContext.accessibleClubIds } },
      orderBy: { name: "asc" },
    });
  }

  async findOne(clubId: string, clubContext: ClubContext) {
    this.assertAccessible(clubId, clubContext);
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException("Club not found.");
    }
    return club;
  }

  create(dto: CreateClubDto) {
    return this.prisma.club.create({ data: dto });
  }

  async update(clubId: string, dto: UpdateClubDto) {
    await this.ensureExists(clubId);
    return this.prisma.club.update({ where: { id: clubId }, data: dto });
  }

  async createInvite(clubId: string, dto: CreateInviteDto) {
    await this.ensureExists(clubId);
    const token = randomBytes(32).toString("hex");
    const invite = await this.prisma.invite.create({
      data: {
        email: dto.email,
        clubId,
        role: dto.role,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const appBaseUrl = this.configService.get("APP_BASE_URL", { infer: true });
    const acceptUrl = `${appBaseUrl}/register?token=${token}`;
    await this.mailService.sendMail(
      dto.email,
      "You've been invited to 3x3",
      `You've been invited to join a club on 3x3 as ${dto.role}. Accept your invite: ${acceptUrl}`
    );

    return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
  }

  async listInvites(clubId: string) {
    await this.ensureExists(clubId);
    return this.prisma.invite.findMany({
      where: { clubId },
      select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private assertAccessible(clubId: string, clubContext: ClubContext) {
    if (clubContext.accessibleClubIds === "ALL") return;
    if (!clubContext.accessibleClubIds.includes(clubId)) {
      throw new ForbiddenException("You do not have access to this club.");
    }
  }

  private async ensureExists(clubId: string) {
    const exists = await this.prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException("Club not found.");
    }
  }
}

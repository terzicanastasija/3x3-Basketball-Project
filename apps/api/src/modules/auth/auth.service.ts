import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { Env } from "../../config/env.validation";
import { AcceptInviteDto, LoginDto } from "@3x3/shared";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>
  ) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueTokenPair(user.id, user.email, user.isSuperadmin, user.isScout);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired or revoked.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    // Rotate: revoke the used refresh token and issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.email, user.isSuperadmin, user.isScout);
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<TokenPair> {
    const invite = await this.prisma.invite.findUnique({ where: { token: dto.token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("Invite is invalid or has expired.");
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      await tx.clubMembership.create({
        data: { userId: created.id, clubId: invite.clubId, role: invite.role },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });

    return this.issueTokenPair(user.id, user.email, user.isSuperadmin, user.isScout);
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    isSuperadmin: boolean,
    isScout: boolean
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email, isSuperadmin, isScout },
      {
        secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
        expiresIn: this.configService.get("JWT_ACCESS_TTL", { infer: true }),
      }
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get("JWT_REFRESH_SECRET", { infer: true }),
        expiresIn: this.configService.get("JWT_REFRESH_TTL", { infer: true }),
      }
    );

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}

function hashToken(token: string): string {
  // Refresh tokens are JWTs already; store a hash so a stolen DB row alone can't be
  // replayed as a bearer refresh token without matching the exact original string.
  return createHash("sha256").update(token).digest("hex");
}

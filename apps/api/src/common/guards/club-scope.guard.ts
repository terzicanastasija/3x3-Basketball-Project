import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedRequest, ClubContext } from "../types/authenticated-request";
import { toSharedRole } from "../mappers/role.mapper";

/**
 * Resolves the current user's club scope exactly once per request, right after JwtAuthGuard
 * has populated `request.user`. Every club-scoped service call downstream should take
 * `request.clubContext.accessibleClubIds` and filter on it — never trust a bare `:clubId`
 * path param alone. Superadmins get the 'ALL' sentinel (no filter applied).
 *
 * Scouts also get 'ALL' — for READS only. A Scout has zero ClubMembership rows by design
 * (it's a global flag, not a per-club role — see Role enum's SCOUT comment), so without this
 * they'd fail every club-scoped read (team names, rosters, the clubs list) despite legitimately
 * needing to see any club's data to do their job. This does NOT grant Scouts any extra write
 * power: RostersService/PlayersService's write paths check `user.isSuperadmin` explicitly
 * rather than trusting `accessibleClubIds === "ALL"`, specifically so this read-only widening
 * for Scouts can't be mistaken for a write bypass there.
 */
@Injectable()
export class ClubScopeGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (isPublic || !request.user) {
      return true;
    }

    if (request.user.isSuperadmin || request.user.isScout) {
      request.clubContext = { accessibleClubIds: "ALL", roleByClubId: {} };
      return true;
    }

    const memberships = await this.prisma.clubMembership.findMany({
      where: { userId: request.user.id },
      select: { clubId: true, role: true },
    });

    const clubContext: ClubContext = {
      accessibleClubIds: memberships.map((m) => m.clubId),
      roleByClubId: Object.fromEntries(
        memberships.map((m) => [m.clubId, toSharedRole(m.role)])
      ),
    };
    request.clubContext = clubContext;

    return true;
  }
}

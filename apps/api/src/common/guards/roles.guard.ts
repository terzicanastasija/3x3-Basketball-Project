import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@3x3/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthenticatedRequest } from "../types/authenticated-request";

/**
 * Checks the caller holds one of the @Roles(...) on the route, scoped to the club the route
 * operates on. Route param is `:clubId` by default; pass a different param name into
 * @Roles metadata via a future @RequireClubParam decorator as more modules land — for now,
 * modules whose entity isn't directly club-keyed (e.g. :teamId, :matchId) resolve the owning
 * clubId in their own service/controller before relying on this guard, or skip @Roles and do
 * the check inline. Superadmin always passes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.isSuperadmin) {
      return true;
    }

    const clubId = request.params?.clubId;
    if (!clubId) {
      // No club param on this route — nothing for this guard to scope against.
      // The controller/service is responsible for its own authorization in that case.
      return true;
    }

    const roleInClub = request.clubContext?.roleByClubId?.[clubId];
    if (!roleInClub || !requiredRoles.includes(roleInClub)) {
      throw new ForbiddenException("You do not have the required role in this club.");
    }
    return true;
  }
}

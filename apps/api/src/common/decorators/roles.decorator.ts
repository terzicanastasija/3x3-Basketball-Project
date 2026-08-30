import { SetMetadata } from "@nestjs/common";
import { Role } from "@3x3/shared";

export const ROLES_KEY = "roles";

/** Restricts a route to callers holding one of the given roles in the relevant club (see ClubScopeGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

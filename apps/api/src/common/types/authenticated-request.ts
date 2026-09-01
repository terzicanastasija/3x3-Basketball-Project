import { Request } from "express";
import { Role } from "@3x3/shared";

export interface AuthenticatedUser {
  id: string;
  email: string;
  isSuperadmin: boolean;
  // Global, club-independent flag — see the Role enum's SCOUT comment for why this isn't a
  // ClubMembership role. A Scout can manage video/tags on any match regardless of clubContext.
  isScout: boolean;
}

/**
 * Resolved once per request by ClubScopeGuard, right after JwtAuthGuard populates `user`.
 * `accessibleClubIds === 'ALL'` means no filter should be applied (superadmin only) — every
 * club-scoped service query must branch on that sentinel rather than passing it into an `in: []`.
 */
export interface ClubContext {
  accessibleClubIds: string[] | "ALL";
  roleByClubId: Record<string, Role>;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  clubContext: ClubContext;
}

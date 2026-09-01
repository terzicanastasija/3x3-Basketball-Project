// Role is scoped per-club via ClubMembership, except SUPERADMIN which has no club scope.
// PLAYER is reserved for a later pass (spec: "build later, don't block the architecture") —
// kept in the enum now so no future migration is needed to add it.
//
// SCOUT is a special case: it exists here as an enum value (a ClubMembership row could in
// principle hold it), but the actual video-upload/tagging permission is granted by the
// separate `User.isScout` boolean flag, NOT by a SCOUT-role ClubMembership — a Scout tags
// matches across every club, and every other role in this enum is deliberately club-scoped.
// Same shape as how SUPERADMIN works (a flag + no club scope), see User.isSuperadmin.
export enum Role {
  SUPERADMIN = "SUPERADMIN",
  CLUB_ADMIN = "CLUB_ADMIN",
  COACH = "COACH",
  SCOUT = "SCOUT",
  PLAYER = "PLAYER",
}

// Roles assignable from the v1 UI (invite flow, role-assignment screens).
// SCOUT/PLAYER exist in the Role enum but are intentionally excluded here.
export const ASSIGNABLE_ROLES_V1: Role[] = [Role.CLUB_ADMIN, Role.COACH];

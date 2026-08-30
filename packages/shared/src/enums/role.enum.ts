// Role is scoped per-club via ClubMembership, except SUPERADMIN which has no club scope.
// SCOUT and PLAYER are reserved for a later pass (spec: "build later, don't block the
// architecture") — kept in the enum now so no future migration is needed to add them.
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

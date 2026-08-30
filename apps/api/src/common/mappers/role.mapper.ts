import { Role as PrismaRole } from "@prisma/client";
import { Role } from "@3x3/shared";

/**
 * Prisma generates its own `Role` enum type from schema.prisma, distinct (nominally, in TS)
 * from `@3x3/shared`'s `Role` even though the two are kept in sync by hand and share identical
 * string values. This cast is the single place that bridges them — safe as long as
 * schema.prisma's `enum Role` and packages/shared/src/enums/role.enum.ts stay in sync.
 */
export function toSharedRole(role: PrismaRole): Role {
  return role as unknown as Role;
}

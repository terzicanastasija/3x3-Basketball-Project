import { z } from "zod";
import { ASSIGNABLE_ROLES_V1, Role } from "../enums/role.enum";

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role).refine((role) => ASSIGNABLE_ROLES_V1.includes(role), {
    message: "Role must be COACH or CLUB_ADMIN.",
  }),
});
export type CreateInviteDto = z.infer<typeof createInviteSchema>;

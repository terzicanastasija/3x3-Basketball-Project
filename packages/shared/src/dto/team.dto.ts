import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(1),
  jerseyColor: z.string().min(1).optional(),
});
export type CreateTeamDto = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamDto = z.infer<typeof updateTeamSchema>;

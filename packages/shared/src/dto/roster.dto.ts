import { z } from "zod";

export const createRosterSchema = z.object({
  tournamentId: z.string().min(1),
});
export type CreateRosterDto = z.infer<typeof createRosterSchema>;

export const addRosterPlayerSchema = z.object({
  playerId: z.string().min(1),
  jerseyNumber: z.coerce.number().int().nonnegative().optional(),
});
export type AddRosterPlayerDto = z.infer<typeof addRosterPlayerSchema>;

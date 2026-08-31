import { z } from "zod";
import { TournamentFormat } from "../enums/tournament-format.enum";

export const createTournamentSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  format: z.nativeEnum(TournamentFormat),
  ageCategory: z.string().min(1).optional(),
  clubId: z.string().min(1).optional(),
});
export type CreateTournamentDto = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = createTournamentSchema.partial();
export type UpdateTournamentDto = z.infer<typeof updateTournamentSchema>;

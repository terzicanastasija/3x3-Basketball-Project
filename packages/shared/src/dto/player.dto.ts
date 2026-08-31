import { z } from "zod";
import { Handedness } from "../enums/player.enum";

export const createPlayerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // A player must belong to a club to be created via this flow — a Phase 1 simplification.
  // Reassigning a player to a different club is out of scope for Phase 1.
  homeClubId: z.string().min(1),
  dateOfBirth: z.coerce.date().optional(),
  heightCm: z.coerce.number().int().positive().optional(),
  dominantHand: z.nativeEnum(Handedness).optional(),
  photoUrl: z.string().url().optional(),
  position: z.string().min(1).optional(),
});
export type CreatePlayerDto = z.infer<typeof createPlayerSchema>;

export const updatePlayerSchema = createPlayerSchema.omit({ homeClubId: true }).partial();
export type UpdatePlayerDto = z.infer<typeof updatePlayerSchema>;

export const playerSearchQuerySchema = z.object({
  clubId: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  minAge: z.coerce.number().int().nonnegative().optional(),
  maxAge: z.coerce.number().int().nonnegative().optional(),
  // Points-per-game, derived from the player's CAREER-scope StatSnapshot (points / gamesPlayed).
  // A player with no CAREER row yet (never played in a locked match) counts as 0 PPG.
  minPpg: z.coerce.number().nonnegative().optional(),
  maxPpg: z.coerce.number().nonnegative().optional(),
});
export type PlayerSearchQueryDto = z.infer<typeof playerSearchQuerySchema>;

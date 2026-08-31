import { z } from "zod";
import { MatchEndType, MatchStatus } from "../enums/match.enum";

export const createMatchSchema = z
  .object({
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: "homeTeamId and awayTeamId must differ.",
    path: ["awayTeamId"],
  });
export type CreateMatchDto = z.infer<typeof createMatchSchema>;

// Pre-game scheduling fields only — recording a result (and the PLAYED transition) goes
// through recordMatchResultSchema/the /result endpoint instead.
export const updateMatchSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  status: z
    .nativeEnum(MatchStatus)
    .refine((status) => status !== MatchStatus.PLAYED, {
      message: "Use PATCH /matches/:matchId/result to mark a match PLAYED.",
    })
    .optional(),
});
export type UpdateMatchDto = z.infer<typeof updateMatchSchema>;

export const recordMatchResultSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
  endType: z.nativeEnum(MatchEndType),
  homeTeamFouls: z.coerce.number().int().nonnegative(),
  awayTeamFouls: z.coerce.number().int().nonnegative(),
});
export type RecordMatchResultDto = z.infer<typeof recordMatchResultSchema>;

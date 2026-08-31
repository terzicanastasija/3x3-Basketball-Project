import { z } from "zod";
import { ActionType } from "../enums/action-type.enum";

// pointValue is deliberately NOT accepted from the client — the server derives it from
// actionType via pointValueForActionType(). Never trust a client-supplied point value.
export const createTagSchema = z.object({
  videoAssetId: z.string().min(1).optional(),
  timestampSec: z.coerce.number().nonnegative(),
  actionType: z.nativeEnum(ActionType),
  teamId: z.string().min(1),
  playerId: z.string().min(1).optional(),
  relatedPlayerId: z.string().min(1).optional(),
  isMade: z.boolean().optional(),
});
export type CreateTagDto = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  timestampSec: z.coerce.number().nonnegative().optional(),
  actionType: z.nativeEnum(ActionType).optional(),
  playerId: z.string().min(1).nullable().optional(),
  relatedPlayerId: z.string().min(1).nullable().optional(),
  isMade: z.boolean().nullable().optional(),
});
export type UpdateTagDto = z.infer<typeof updateTagSchema>;

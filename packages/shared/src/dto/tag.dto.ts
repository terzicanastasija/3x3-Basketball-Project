import { z } from "zod";
import { ActionType } from "../enums/action-type.enum";

// A manual Synergy-style in/out mark: either both set, or neither — never just one, and the
// out-point must be strictly after the in-point. When omitted, clip generation falls back to
// the automatic CLIP_SECONDS_BEFORE/AFTER window around timestampSec.
const clipWindowFields = {
  clipInSec: z.coerce.number().nonnegative().optional(),
  clipOutSec: z.coerce.number().nonnegative().optional(),
};

function refineClipWindow<T extends { clipInSec?: number; clipOutSec?: number }>(data: T, ctx: z.RefinementCtx) {
  const { clipInSec, clipOutSec } = data;
  if ((clipInSec === undefined) !== (clipOutSec === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "clipInSec and clipOutSec must be set together, never just one.",
      path: ["clipOutSec"],
    });
    return;
  }
  if (clipInSec !== undefined && clipOutSec !== undefined && clipOutSec <= clipInSec) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "clipOutSec must be after clipInSec.",
      path: ["clipOutSec"],
    });
  }
}

// pointValue is deliberately NOT accepted from the client — the server derives it from
// actionType via pointValueForActionType(). Never trust a client-supplied point value.
export const createTagSchema = z
  .object({
    videoAssetId: z.string().min(1).optional(),
    timestampSec: z.coerce.number().nonnegative(),
    actionType: z.nativeEnum(ActionType),
    teamId: z.string().min(1),
    playerId: z.string().min(1).optional(),
    relatedPlayerId: z.string().min(1).optional(),
    isMade: z.boolean().optional(),
    ...clipWindowFields,
  })
  .superRefine(refineClipWindow);
export type CreateTagDto = z.infer<typeof createTagSchema>;

export const updateTagSchema = z
  .object({
    timestampSec: z.coerce.number().nonnegative().optional(),
    actionType: z.nativeEnum(ActionType).optional(),
    playerId: z.string().min(1).nullable().optional(),
    relatedPlayerId: z.string().min(1).nullable().optional(),
    isMade: z.boolean().nullable().optional(),
    ...clipWindowFields,
  })
  .superRefine(refineClipWindow);
export type UpdateTagDto = z.infer<typeof updateTagSchema>;

import { z } from "zod";
import { VideoSourceType } from "../enums/video.enum";

export const requestUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});
export type RequestUploadUrlDto = z.infer<typeof requestUploadUrlSchema>;

// Loose but real: catches obviously-wrong input without trying to be a full URL validator.
const YOUTUBE_URL_PATTERN = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;

export const registerVideoSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal(VideoSourceType.FILE),
    fileKey: z.string().min(1),
    durationSec: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    sourceType: z.literal(VideoSourceType.EXTERNAL),
    externalUrl: z.string().regex(YOUTUBE_URL_PATTERN, "Must be a YouTube URL."),
    durationSec: z.coerce.number().int().positive().optional(),
  }),
]);
export type RegisterVideoDto = z.infer<typeof registerVideoSchema>;

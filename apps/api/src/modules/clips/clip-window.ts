import { CLIP_SECONDS_AFTER, CLIP_SECONDS_BEFORE } from "@3x3/shared";

export interface ClipWindow {
  /** Seconds into the source video where the clip should start (never negative). */
  start: number;
  /** Length of the clip in seconds. */
  duration: number;
}

/**
 * Computes the [start, start+duration) window to cut around a tagged action.
 *
 * When the tag carries a manual Synergy-style in/out mark (clipInSec/clipOutSec — always set
 * together, validated at the DTO layer), that exact window is used verbatim, clamped to 0.
 * Otherwise falls back to the automatic window: the end is timestampSec + CLIP_SECONDS_AFTER
 * (fixed), and the start is timestampSec - CLIP_SECONDS_BEFORE, clamped to 0 — a tag near the
 * very start of a video gets a shorter clip (less lead-in available) rather than a negative
 * `-ss` passed to ffmpeg.
 */
export function computeClipWindow(
  timestampSec: number,
  clipInSec?: number | null,
  clipOutSec?: number | null
): ClipWindow {
  if (clipInSec != null && clipOutSec != null) {
    const start = Math.max(0, clipInSec);
    return { start, duration: clipOutSec - start };
  }
  const start = Math.max(0, timestampSec - CLIP_SECONDS_BEFORE);
  const end = timestampSec + CLIP_SECONDS_AFTER;
  return { start, duration: end - start };
}

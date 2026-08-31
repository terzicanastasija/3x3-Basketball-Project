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
 * The end of the window (timestampSec + CLIP_SECONDS_AFTER) is fixed. The start is
 * timestampSec - CLIP_SECONDS_BEFORE, clamped to 0 — a tag near the very start of a video gets
 * a shorter clip (less lead-in available) rather than a negative `-ss` passed to ffmpeg.
 */
export function computeClipWindow(timestampSec: number): ClipWindow {
  const start = Math.max(0, timestampSec - CLIP_SECONDS_BEFORE);
  const end = timestampSec + CLIP_SECONDS_AFTER;
  return { start, duration: end - start };
}

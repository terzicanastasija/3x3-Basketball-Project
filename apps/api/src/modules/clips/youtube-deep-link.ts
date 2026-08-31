// Handles both YouTube URL shapes accepted by video.dto.ts's registerVideoSchema:
// https://www.youtube.com/watch?v=<id>[...] and https://youtu.be/<id>[...]
const WATCH_PATTERN = /^https:\/\/(www\.)?youtube\.com\/watch\?v=([\w-]+)/;
const SHORT_PATTERN = /^https:\/\/(www\.)?youtu\.be\/([\w-]+)/;

/**
 * Builds a timestamped deep link into a YouTube video — no ffmpeg, no job, no storage. This is
 * the entire "clip" for an EXTERNAL-source tag; YouTube's ToS and the lack of a local file to
 * cut server-side mean there's nothing to generate for these.
 */
export function buildYoutubeDeepLink(externalUrl: string, timestampSec: number): string {
  const videoId = extractVideoId(externalUrl);
  const seconds = Math.floor(timestampSec);
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

function extractVideoId(url: string): string {
  const watchMatch = url.match(WATCH_PATTERN);
  if (watchMatch) return watchMatch[2];
  const shortMatch = url.match(SHORT_PATTERN);
  if (shortMatch) return shortMatch[2];
  throw new Error(`Could not extract a YouTube video ID from: ${url}`);
}

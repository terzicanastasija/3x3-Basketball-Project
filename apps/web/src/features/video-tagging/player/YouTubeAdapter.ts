import { VideoPlayerAdapter } from "./VideoPlayerAdapter";
import { loadYouTubeApi } from "./loadYouTubeApi";

const POLL_INTERVAL_MS = 250;

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * Async because constructing a YT.Player requires the IFrame API script to have loaded first —
 * callers await this before using the adapter (the tagging screen shows a loading state
 * meanwhile, mirroring how a real <video> briefly has no duration before `loadedmetadata`).
 */
export async function createYouTubeAdapter(
  container: HTMLElement,
  videoId: string
): Promise<VideoPlayerAdapter> {
  await loadYouTubeApi();

  let timeUpdateCb: ((t: number) => void) | null = null;
  let readyCb: (() => void) | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;

  const player = await new Promise<YT.Player>((resolve) => {
    const instance = new window.YT!.Player(container, {
      videoId,
      events: {
        onReady: () => {
          readyCb?.();
          resolve(instance);
        },
      },
    });
  });

  // YouTube's player has no native timeupdate event — poll instead.
  pollHandle = setInterval(() => timeUpdateCb?.(player.getCurrentTime()), POLL_INTERVAL_MS);

  return {
    getCurrentTime: () => player.getCurrentTime(),
    seekTo: (seconds) => player.seekTo(seconds, true),
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    setPlaybackRate: (rate) => player.setPlaybackRate(rate),
    getDuration: () => player.getDuration(),
    onTimeUpdate: (cb) => {
      timeUpdateCb = cb;
    },
    onReady: (cb) => {
      readyCb = cb;
    },
    destroy: () => {
      if (pollHandle) clearInterval(pollHandle);
      player.destroy();
    },
  };
}

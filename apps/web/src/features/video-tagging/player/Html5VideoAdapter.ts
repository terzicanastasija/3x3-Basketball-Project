import { VideoPlayerAdapter } from "./VideoPlayerAdapter";

export function createHtml5VideoAdapter(video: HTMLVideoElement): VideoPlayerAdapter {
  let timeUpdateCb: ((t: number) => void) | null = null;
  let readyCb: (() => void) | null = null;

  const handleTimeUpdate = () => timeUpdateCb?.(video.currentTime);
  const handleReady = () => readyCb?.();

  video.addEventListener("timeupdate", handleTimeUpdate);
  // loadedmetadata fires once duration/dimensions are known — the natural "ready" point for
  // a native <video>, mirroring YouTube's onReady semantics.
  video.addEventListener("loadedmetadata", handleReady);

  return {
    getCurrentTime: () => video.currentTime,
    seekTo: (seconds) => {
      video.currentTime = seconds;
    },
    play: () => void video.play(),
    pause: () => video.pause(),
    setPlaybackRate: (rate) => {
      video.playbackRate = rate;
    },
    getDuration: () => video.duration || 0,
    onTimeUpdate: (cb) => {
      timeUpdateCb = cb;
    },
    onReady: (cb) => {
      readyCb = cb;
    },
    destroy: () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleReady);
    },
  };
}

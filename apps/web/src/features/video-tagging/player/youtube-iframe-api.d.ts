// Minimal ambient typing for the parts of the YouTube IFrame Player API this app actually uses.
// Not an exhaustive declaration of YouTube's SDK.
declare namespace YT {
  interface PlayerEvent {
    target: Player;
  }
  interface OnStateChangeEvent extends PlayerEvent {
    data: number;
  }
  interface PlayerOptions {
    videoId: string;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
    };
  }
  class Player {
    constructor(elementId: HTMLElement | string, options: PlayerOptions);
    getCurrentTime(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    setPlaybackRate(rate: number): void;
    getDuration(): number;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}

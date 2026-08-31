// Source-agnostic control surface for the tagging screen. All tagging/hotkey/UI logic must
// code against this interface only — never branch on VideoSourceType outside the factory
// (createPlayerAdapter.ts). This is what lets Html5VideoAdapter (FILE) and YouTubeAdapter
// (EXTERNAL) be interchangeable from the tagging screen's perspective.
export interface VideoPlayerAdapter {
  getCurrentTime(): number;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
  setPlaybackRate(rate: number): void;
  getDuration(): number;
  onTimeUpdate(cb: (t: number) => void): void;
  onReady(cb: () => void): void;
  destroy(): void;
}

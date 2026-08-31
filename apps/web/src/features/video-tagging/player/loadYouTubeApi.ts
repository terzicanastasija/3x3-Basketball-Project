// The YouTube IFrame API loads itself as a global `window.YT` and calls a single global
// `window.onYouTubeIframeAPIReady` once ready — this wraps that one-shot global callback in a
// promise, and is safe to call more than once (e.g. two adapters mounted in sequence).
let apiReadyPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API requires a browser environment."));
  }
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  apiReadyPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return apiReadyPromise;
}

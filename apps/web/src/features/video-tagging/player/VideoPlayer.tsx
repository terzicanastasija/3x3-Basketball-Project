import { useEffect, useRef } from "react";
import { VideoPlayerAdapter } from "./VideoPlayerAdapter";
import { createHtml5VideoAdapter } from "./Html5VideoAdapter";
import { createYouTubeAdapter, extractYouTubeVideoId } from "./YouTubeAdapter";

interface VideoPlayerProps {
  sourceType: "FILE" | "EXTERNAL";
  src: string;
  onAdapterReady: (adapter: VideoPlayerAdapter) => void;
}

/**
 * The only place in the app that branches on sourceType — everything downstream (the tagging
 * screen) only ever sees a VideoPlayerAdapter and never knows which implementation it got.
 */
export function VideoPlayer({ sourceType, src, onAdapterReady }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let adapter: VideoPlayerAdapter | null = null;
    let cancelled = false;

    if (sourceType === "FILE" && videoRef.current) {
      adapter = createHtml5VideoAdapter(videoRef.current);
      onAdapterReady(adapter);
    } else if (sourceType === "EXTERNAL" && containerRef.current) {
      const videoId = extractYouTubeVideoId(src);
      if (videoId) {
        void createYouTubeAdapter(containerRef.current, videoId).then((created) => {
          if (cancelled) {
            created.destroy();
            return;
          }
          adapter = created;
          onAdapterReady(created);
        });
      }
    }

    return () => {
      cancelled = true;
      adapter?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, src]);

  if (sourceType === "FILE") {
    return <video ref={videoRef} src={src} controls style={{ width: "100%", maxWidth: 480 }} />;
  }
  return <div ref={containerRef} style={{ width: 480, height: 270 }} />;
}

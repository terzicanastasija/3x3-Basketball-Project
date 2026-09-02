import { useState } from "react";
import { useTranslation } from "react-i18next";
import { VideoSourceType } from "@3x3/shared";
import { uploadFileToPresignedUrl, useRegisterVideo, useVideosForMatch, VideoAsset } from "./api";

interface VideoRegistrationPanelProps {
  matchId: string;
  selectedVideoId: string | null;
  onSelect: (videoId: string) => void;
}

export function VideoRegistrationPanel({ matchId, selectedVideoId, onSelect }: VideoRegistrationPanelProps) {
  const { t } = useTranslation();
  const { data: videos, isLoading } = useVideosForMatch(matchId);
  const registerVideo = useRegisterVideo(matchId);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setUploadState("uploading");
    try {
      const fileKey = await uploadFileToPresignedUrl(matchId, file);
      const video = await registerVideo.mutateAsync({
        sourceType: VideoSourceType.FILE,
        fileKey,
        durationSec: undefined,
      });
      setUploadState("idle");
      onSelect(video.id);
    } catch {
      setUploadState("error");
    }
  }

  async function handleRegisterYoutube() {
    if (!youtubeUrl) return;
    const video = await registerVideo.mutateAsync({
      sourceType: VideoSourceType.EXTERNAL,
      externalUrl: youtubeUrl,
    });
    setYoutubeUrl("");
    onSelect(video.id);
  }

  return (
    <div className="card">
      <h2>{t("tagging.video.title")}</h2>
      {isLoading && <p>{t("home.loading")}</p>}
      {!isLoading && (videos?.length ?? 0) > 0 && (
        <ul>
          {videos!.map((video: VideoAsset) => (
            <li key={video.id}>
              <label>
                <input
                  type="radio"
                  name="video"
                  checked={selectedVideoId === video.id}
                  onChange={() => onSelect(video.id)}
                />
                {video.sourceType === VideoSourceType.FILE
                  ? t("tagging.video.fileLabel")
                  : video.externalUrl}
              </label>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
        <div>
          <label>
            {t("tagging.video.uploadFile")}
            <input
              type="file"
              accept="video/*"
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
              disabled={uploadState === "uploading"}
            />
          </label>
          {uploadState === "uploading" && <p className="hint">{t("tagging.video.uploading")}</p>}
          {uploadState === "error" && <p className="field-error">{t("tagging.video.uploadError")}</p>}
        </div>
        <div>
          <label>
            {t("tagging.video.youtubeUrl")}
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ width: 260 }}
            />
          </label>
          <button
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => void handleRegisterYoutube()}
            disabled={registerVideo.isPending}
          >
            {t("tagging.video.registerYoutube")}
          </button>
        </div>
      </div>
    </div>
  );
}

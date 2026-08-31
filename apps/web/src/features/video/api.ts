import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RegisterVideoDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface VideoAsset {
  id: string;
  matchId: string;
  sourceType: "FILE" | "EXTERNAL";
  fileKey: string | null;
  externalUrl: string | null;
  durationSec: number | null;
  processingStatus: string;
}

function videosKey(matchId: string) {
  return ["matches", matchId, "videos"];
}

export function useVideosForMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: videosKey(matchId ?? ""),
    queryFn: () => apiFetch<VideoAsset[]>(`/matches/${matchId}/videos`),
    enabled: Boolean(matchId),
  });
}

export function usePlaybackUrl(videoAssetId: string | undefined) {
  return useQuery({
    queryKey: ["videos", videoAssetId, "playback-url"],
    queryFn: () =>
      apiFetch<{ url: string; sourceType: string }>(`/videos/${videoAssetId}/playback-url`),
    enabled: Boolean(videoAssetId),
  });
}

export function useRegisterVideo(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RegisterVideoDto) =>
      apiFetch<VideoAsset>(`/matches/${matchId}/videos`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: videosKey(matchId) }),
  });
}

/**
 * Two-step FILE upload: ask the API for a presigned MinIO PUT URL, then PUT the raw file
 * bytes directly to MinIO (not through apiFetch — that's for our own JSON API, this is a
 * one-off external URL with its own content-type), then the caller registers the VideoAsset.
 */
export async function uploadFileToPresignedUrl(matchId: string, file: File): Promise<string> {
  const { fileKey, uploadUrl } = await apiFetch<{ fileKey: string; uploadUrl: string }>(
    `/matches/${matchId}/videos/upload-url`,
    { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type }) }
  );

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error(`Upload to storage failed: ${putResponse.status}`);
  }

  return fileKey;
}

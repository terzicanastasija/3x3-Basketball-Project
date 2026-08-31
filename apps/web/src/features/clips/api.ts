import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateCompilationDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface TagClipInfo {
  type: "NONE" | "DEEP_LINK" | "CLIP";
  status?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  url?: string;
  errorMessage?: string | null;
}

// Polls only while a real ffmpeg job is still in flight (QUEUED/PROCESSING) — a DEEP_LINK or an
// already-COMPLETED/FAILED clip needs no polling at all, same "stop once ready" shape as
// Phase 4's useStatRecomputeStatus.
export function useTagClip(tagId: string | undefined) {
  return useQuery({
    queryKey: ["tags", tagId, "clip"],
    queryFn: () => apiFetch<TagClipInfo>(`/tags/${tagId}/clip`),
    enabled: Boolean(tagId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.type === "CLIP" && (data.status === "QUEUED" || data.status === "PROCESSING")) return 1000;
      return false;
    },
  });
}

export interface Compilation {
  id: string;
  title: string;
  createdById: string;
  createdAt: string;
}

export interface CompilationItem {
  id: string;
  order: number;
  actionTagId: string;
  actionTag: { id: string; actionType: string; timestampSec: number; matchId: string; playerId: string | null };
  clip: TagClipInfo;
}

export interface CompilationDetail extends Compilation {
  items: CompilationItem[];
}

export function useCompilations() {
  return useQuery({
    queryKey: ["compilations"],
    queryFn: () => apiFetch<Compilation[]>("/compilations"),
  });
}

export function useCompilation(id: string | undefined) {
  return useQuery({
    queryKey: ["compilations", id],
    queryFn: () => apiFetch<CompilationDetail>(`/compilations/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCompilation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCompilationDto) =>
      apiFetch<Compilation>("/compilations", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compilations"] }),
  });
}

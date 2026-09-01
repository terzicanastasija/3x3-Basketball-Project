import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionType, CreateTagDto, UpdateTagDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface ActionTag {
  id: string;
  matchId: string;
  videoAssetId: string | null;
  timestampSec: number;
  actionType: ActionType;
  teamId: string;
  playerId: string | null;
  relatedPlayerId: string | null;
  pointValue: number | null;
  isMade: boolean | null;
  clipInSec: number | null;
  clipOutSec: number | null;
  player: { id: string; firstName: string; lastName: string } | null;
  relatedPlayer: { id: string; firstName: string; lastName: string } | null;
}

function tagsKey(matchId: string) {
  return ["matches", matchId, "tags"];
}

export function useTagsForMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: tagsKey(matchId ?? ""),
    queryFn: () => apiFetch<ActionTag[]>(`/matches/${matchId}/tags`),
    enabled: Boolean(matchId),
  });
}

export function useCreateTag(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTagDto) =>
      apiFetch<ActionTag>(`/matches/${matchId}/tags`, { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagsKey(matchId) }),
  });
}

export function useUpdateTag(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, dto }: { tagId: string; dto: UpdateTagDto }) =>
      apiFetch<ActionTag>(`/tags/${tagId}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagsKey(matchId) }),
  });
}

export function useDeleteTag(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => apiFetch(`/tags/${tagId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagsKey(matchId) }),
  });
}

export function useLockMatch(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/matches/${matchId}/lock`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", matchId] });
      queryClient.invalidateQueries({ queryKey: tagsKey(matchId) });
    },
  });
}

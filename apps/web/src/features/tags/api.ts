import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionType, CreateTagDto, TagSearchQueryDto, UpdateTagDto } from "@3x3/shared";
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
  defenderId: string | null;
  pointValue: number | null;
  isMade: boolean | null;
  clipInSec: number | null;
  clipOutSec: number | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  player: { id: string; firstName: string; lastName: string } | null;
  relatedPlayer: { id: string; firstName: string; lastName: string } | null;
  defender: { id: string; firstName: string; lastName: string } | null;
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
}

// search() additionally resolves match/team/tournament context per row, since (unlike a
// per-match tag list) a search result can come from any match.
export interface TagSearchResult extends ActionTag {
  match: {
    id: string;
    tournamentId: string;
    phase: string | null;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    tournament: { id: string; name: string };
  };
}

function tagsKey(matchId: string) {
  return ["matches", matchId, "tags"];
}

const SEARCH_KEY = ["tags", "search"];

export function useTagsForMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: tagsKey(matchId ?? ""),
    queryFn: () => apiFetch<ActionTag[]>(`/matches/${matchId}/tags`),
    enabled: Boolean(matchId),
  });
}

function toSearchQueryString(query: TagSearchQueryDto): string {
  const params = new URLSearchParams();
  if (query.tournamentId) params.set("tournamentId", query.tournamentId);
  if (query.matchId) params.set("matchId", query.matchId);
  if (query.teamId) params.set("teamId", query.teamId);
  if (query.playerId) params.set("playerId", query.playerId);
  if (query.defenderId) params.set("defenderId", query.defenderId);
  if (query.actionType) params.set("actionType", query.actionType);
  if (query.isMade !== undefined) params.set("isMade", String(query.isMade));
  if (query.reviewed !== undefined) params.set("reviewed", String(query.reviewed));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useSearchTags(query: TagSearchQueryDto) {
  return useQuery({
    queryKey: [...SEARCH_KEY, query],
    queryFn: () => apiFetch<TagSearchResult[]>(`/tags${toSearchQueryString(query)}`),
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

// Admin-only QA toggle. Not scoped to one match's query key at construction time (unlike the
// mutations above) since it's also used from the cross-match search page — invalidates whichever
// match the returned tag actually belongs to, plus the search results.
export function useReviewTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => apiFetch<ActionTag>(`/tags/${tagId}/review`, { method: "POST" }),
    onSuccess: (updatedTag) => {
      queryClient.invalidateQueries({ queryKey: tagsKey(updatedTag.matchId) });
      queryClient.invalidateQueries({ queryKey: SEARCH_KEY });
    },
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

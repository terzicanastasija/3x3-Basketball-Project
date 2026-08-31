import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreatePlayerDto, PlayerSearchQueryDto, UpdatePlayerDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  heightCm: number | null;
  dominantHand: string;
  photoUrl: string | null;
  homeClubId: string | null;
  position: string | null;
  homeClub: { id: string; name: string; city: string | null } | null;
}

function toQueryString(query: PlayerSearchQueryDto): string {
  const params = new URLSearchParams();
  if (query.clubId) params.set("clubId", query.clubId);
  if (query.city) params.set("city", query.city);
  if (query.minAge !== undefined) params.set("minAge", String(query.minAge));
  if (query.maxAge !== undefined) params.set("maxAge", String(query.maxAge));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function usePlayers(query: PlayerSearchQueryDto) {
  return useQuery({
    queryKey: ["players", query],
    queryFn: () => apiFetch<Player[]>(`/players${toQueryString(query)}`),
  });
}

export function usePlayer(playerId: string | undefined) {
  return useQuery({
    queryKey: ["players", "detail", playerId],
    queryFn: () => apiFetch<Player>(`/players/${playerId}`),
    enabled: Boolean(playerId),
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePlayerDto) =>
      apiFetch<Player>("/players", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useUpdatePlayer(playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdatePlayerDto) =>
      apiFetch<Player>(`/players/${playerId}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["players", "detail", playerId] });
    },
  });
}

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateTeamDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface Team {
  id: string;
  clubId: string;
  name: string;
  jerseyColor: string | null;
}

export function useTeamsForClub(clubId: string | undefined) {
  return useQuery({
    queryKey: ["clubs", clubId, "teams"],
    queryFn: () => apiFetch<Team[]>(`/clubs/${clubId}/teams`),
    enabled: Boolean(clubId),
  });
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teams", teamId],
    queryFn: () => apiFetch<Team>(`/teams/${teamId}`),
    enabled: Boolean(teamId),
  });
}

// Same query key as useTeam, so results are shared with the cache — used where a plain string
// name is needed synchronously (e.g. a <select><option> label, which can't host its own
// per-row data-fetching component the way a list item can).
export function useTeams(teamIds: string[]) {
  return useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: ["teams", teamId],
      queryFn: () => apiFetch<Team>(`/teams/${teamId}`),
    })),
  });
}

export function useCreateTeam(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTeamDto) =>
      apiFetch<Team>(`/clubs/${clubId}/teams`, { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clubs", clubId, "teams"] }),
  });
}

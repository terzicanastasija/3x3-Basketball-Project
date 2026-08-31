import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddRosterPlayerDto } from "@3x3/shared";
import { apiFetch, ApiError } from "../../lib/api-client";

export interface RosterPlayerEntry {
  id: string;
  playerId: string;
  jerseyNumber: number | null;
  player: { id: string; firstName: string; lastName: string };
}

export interface Roster {
  id: string;
  teamId: string;
  tournamentId: string;
  players: RosterPlayerEntry[];
}

function rosterKey(teamId: string, tournamentId: string) {
  return ["teams", teamId, "rosters", tournamentId];
}

export function useRoster(teamId: string | undefined, tournamentId: string | undefined) {
  return useQuery({
    queryKey: rosterKey(teamId ?? "", tournamentId ?? ""),
    queryFn: async () => {
      try {
        return await apiFetch<Roster>(`/teams/${teamId}/rosters/${tournamentId}`);
      } catch (error) {
        // No roster yet for this pair is a normal, expected state (not an error condition) —
        // the "create roster" button is what the UI shows in its place.
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(teamId && tournamentId),
  });
}

export function useCreateOrGetRoster(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: string) =>
      apiFetch<Roster>(`/teams/${teamId}/rosters`, {
        method: "POST",
        body: JSON.stringify({ tournamentId }),
      }),
    onSuccess: (roster) => {
      queryClient.invalidateQueries({ queryKey: rosterKey(teamId, roster.tournamentId) });
    },
  });
}

export function useAddRosterPlayer(teamId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddRosterPlayerDto) =>
      apiFetch(`/teams/${teamId}/rosters/${tournamentId}/players`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rosterKey(teamId, tournamentId) }),
  });
}

export function useRemoveRosterPlayer(teamId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) =>
      apiFetch(`/teams/${teamId}/rosters/${tournamentId}/players/${playerId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rosterKey(teamId, tournamentId) }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateMatchDto, RecordMatchResultDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface Match {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  phase: string | null;
  scheduledAt: string | null;
  status: string;
  endType: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamFouls: number;
  awayTeamFouls: number;
  lockedAt: string | null;
}

function matchKey(matchId: string) {
  return ["matches", matchId];
}

export function useMatchesForTournament(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ["tournaments", tournamentId, "matches"],
    queryFn: () => apiFetch<Match[]>(`/tournaments/${tournamentId}/matches`),
    enabled: Boolean(tournamentId),
  });
}

export function useMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: matchKey(matchId ?? ""),
    queryFn: () => apiFetch<Match>(`/matches/${matchId}`),
    enabled: Boolean(matchId),
  });
}

export function useCreateMatch(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMatchDto) =>
      apiFetch<Match>(`/tournaments/${tournamentId}/matches`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId, "matches"] }),
  });
}

export function useRecordMatchResult(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordMatchResultDto) =>
      apiFetch<Match>(`/matches/${matchId}/result`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: (match) => {
      queryClient.invalidateQueries({ queryKey: matchKey(matchId) });
      queryClient.invalidateQueries({ queryKey: ["tournaments", match.tournamentId, "matches"] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateTournamentDto, UpdateTournamentDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  format: string;
  ageCategory: string | null;
  clubId: string | null;
}

export function useTournaments() {
  return useQuery({ queryKey: ["tournaments"], queryFn: () => apiFetch<Tournament[]>("/tournaments") });
}

export function useTournament(tournamentId: string | undefined) {
  return useQuery({
    queryKey: ["tournaments", tournamentId],
    queryFn: () => apiFetch<Tournament>(`/tournaments/${tournamentId}`),
    enabled: Boolean(tournamentId),
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTournamentDto) =>
      apiFetch<Tournament>("/tournaments", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
  });
}

export function useUpdateTournament(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateTournamentDto) =>
      apiFetch<Tournament>(`/tournaments/${tournamentId}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
    },
  });
}

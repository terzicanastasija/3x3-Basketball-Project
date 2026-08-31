import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

export interface StatLine {
  id: string;
  scopeType: "MATCH" | "TOURNAMENT" | "CAREER";
  playerId: string | null;
  teamId: string | null;
  matchId: string | null;
  tournamentId: string | null;
  gamesPlayed: number;
  points: number;
  shots1ptMade: number;
  shots1ptAtt: number;
  shots2ptMade: number;
  shots2ptAtt: number;
  ftMade: number;
  ftAtt: number;
  offRebounds: number;
  defRebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  personalFouls: number;
}

export interface MatchDashboardRow extends StatLine {
  player: { id: string; firstName: string; lastName: string } | null;
  team: { id: string; name: string } | null;
}

export interface PlayerMatchStatLine extends StatLine {
  match: {
    id: string;
    tournamentId: string;
    homeTeamId: string;
    awayTeamId: string;
    scheduledAt: string | null;
  };
}

export interface PlayerDashboard {
  career: StatLine | null;
  matches: PlayerMatchStatLine[];
}

export function useMatchDashboard(matchId: string | undefined) {
  return useQuery({
    queryKey: ["dashboards", "match", matchId],
    queryFn: () => apiFetch<MatchDashboardRow[]>(`/matches/${matchId}/dashboard`),
    enabled: Boolean(matchId),
  });
}

export function useTeamDashboard(teamId: string | undefined, tournamentId: string | undefined) {
  return useQuery({
    queryKey: ["dashboards", "team", teamId, tournamentId],
    queryFn: () => apiFetch<StatLine | null>(`/teams/${teamId}/dashboard?tournamentId=${tournamentId}`),
    enabled: Boolean(teamId) && Boolean(tournamentId),
  });
}

export function usePlayerDashboard(playerId: string | undefined) {
  return useQuery({
    queryKey: ["dashboards", "player", playerId],
    queryFn: () => apiFetch<PlayerDashboard>(`/players/${playerId}/dashboard`),
    enabled: Boolean(playerId),
  });
}

// Polled by MatchDetailPage right after locking, so "lock -> dashboard populates" is something
// you can actually watch happen rather than something only provable via curl.
export function useStatRecomputeStatus(matchId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["dashboards", "recompute-status", matchId],
    queryFn: () => apiFetch<{ ready: boolean }>(`/matches/${matchId}/stat-recompute-status`),
    enabled: Boolean(matchId) && (options.enabled ?? true),
    refetchInterval: (query) => (query.state.data?.ready ? false : 1000),
  });
}

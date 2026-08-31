import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
}

// Phase-1 placeholder: read-only list to populate the roster builder's tournament picker.
// Full Tournament CRUD lands in Phase 2.
export function useTournaments() {
  return useQuery({ queryKey: ["tournaments"], queryFn: () => apiFetch<Tournament[]>("/tournaments") });
}

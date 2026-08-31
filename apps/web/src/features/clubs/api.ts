import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateClubDto, CreateInviteDto, Role, UpdateClubDto } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";

export interface Club {
  id: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export function useClubs() {
  return useQuery({ queryKey: ["clubs"], queryFn: () => apiFetch<Club[]>("/clubs") });
}

export function useClub(clubId: string | undefined) {
  return useQuery({
    queryKey: ["clubs", clubId],
    queryFn: () => apiFetch<Club>(`/clubs/${clubId}`),
    enabled: Boolean(clubId),
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateClubDto) =>
      apiFetch<Club>("/clubs", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clubs"] }),
  });
}

export function useUpdateClub(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateClubDto) =>
      apiFetch<Club>(`/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
      queryClient.invalidateQueries({ queryKey: ["clubs", clubId] });
    },
  });
}

export function useInvites(clubId: string | undefined) {
  return useQuery({
    queryKey: ["clubs", clubId, "invites"],
    queryFn: () => apiFetch<Invite[]>(`/clubs/${clubId}/invites`),
    enabled: Boolean(clubId),
  });
}

export function useCreateInvite(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInviteDto) =>
      apiFetch<{ id: string; email: string; role: Role; expiresAt: string }>(
        `/clubs/${clubId}/invites`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clubs", clubId, "invites"] }),
  });
}

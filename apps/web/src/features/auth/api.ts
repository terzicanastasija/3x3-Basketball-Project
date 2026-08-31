import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AcceptInviteDto, LoginDto, Role } from "@3x3/shared";
import { apiFetch } from "../../lib/api-client";
import { authStorage } from "../../lib/auth-storage";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperadmin: boolean;
  locale: string;
  memberships: { clubId: string; role: Role; club: { name: string } }[];
}

export function useLogin() {
  return useMutation({
    mutationFn: (dto: LoginDto) =>
      apiFetch<TokenPair>(
        "/auth/login",
        { method: "POST", body: JSON.stringify(dto) },
        { skipAuth: true }
      ),
    onSuccess: (tokens) => {
      authStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiFetch<CurrentUser>("/users/me"),
    enabled: Boolean(authStorage.getAccessToken()),
    retry: false,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (dto: AcceptInviteDto) =>
      apiFetch<TokenPair>(
        "/auth/invite/accept",
        { method: "POST", body: JSON.stringify(dto) },
        { skipAuth: true }
      ),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    authStorage.clear();
    queryClient.clear();
  };
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  createInviteSchema,
  CreateInviteDto,
  createPlayerSchema,
  CreatePlayerDto,
  createTeamSchema,
  CreateTeamDto,
  Role,
} from "@3x3/shared";
import { useClub, useCreateInvite, useInvites } from "../api";
import { useTeamsForClub, useCreateTeam } from "../../teams/api";
import { useCreatePlayer } from "../../players/api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";
import { NavBar } from "../../../components/NavBar";

export function ClubDetailPage() {
  const { t } = useTranslation();
  const { clubId } = useParams<{ clubId: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: club, isLoading } = useClub(clubId);
  const { data: teams } = useTeamsForClub(clubId);
  const { data: invites } = useInvites(clubId);
  const createTeam = useCreateTeam(clubId ?? "");
  const createInvite = useCreateInvite(clubId ?? "");
  const createPlayer = useCreatePlayer();
  const [inviteSent, setInviteSent] = useState(false);

  const membershipRole = currentUser?.memberships.find((m) => m.clubId === clubId)?.role;
  // Club profile management + inviting members is still CLUB_ADMIN territory — unaffected by
  // the RBAC overhaul. Team creation and player-record creation, however, are Admin-only now
  // (see PROGRESS.md's RBAC overhaul note) — real authority is the server either way.
  const isClubAdmin = currentUser?.isSuperadmin || membershipRole === Role.CLUB_ADMIN;
  const canManageTeams = currentUser?.isSuperadmin;
  const canCreatePlayer = currentUser?.isSuperadmin;

  const teamForm = useForm<CreateTeamDto>({ resolver: zodResolver(createTeamSchema) });
  const inviteForm = useForm<CreateInviteDto>({ resolver: zodResolver(createInviteSchema) });
  const playerForm = useForm<CreatePlayerDto>({
    resolver: zodResolver(createPlayerSchema),
    defaultValues: { homeClubId: clubId },
  });

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!club) return <p>{t("clubs.notFound")}</p>;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{club.name}</h1>
      {club.city && <p>{club.city}</p>}

      <h2>{t("clubs.detail.teams")}</h2>
      <ul>
        {teams?.map((team) => (
          <li key={team.id}>
            <Link to={`/clubs/${clubId}/teams/${team.id}`}>{team.name}</Link>
          </li>
        ))}
        {teams?.length === 0 && <li>{t("clubs.detail.noTeams")}</li>}
      </ul>

      {canCreatePlayer && (
        <div style={{ marginTop: 16 }}>
          <h3>{t("clubs.detail.createPlayer")}</h3>
          <form
            onSubmit={playerForm.handleSubmit((dto) =>
              createPlayer.mutate(dto, { onSuccess: () => playerForm.reset({ homeClubId: clubId }) })
            )}
          >
            <input
              {...playerForm.register("firstName")}
              placeholder={t("players.detail.firstName") ?? ""}
              style={{ marginRight: 8 }}
            />
            <input
              {...playerForm.register("lastName")}
              placeholder={t("players.detail.lastName") ?? ""}
              style={{ marginRight: 8 }}
            />
            <button type="submit" disabled={createPlayer.isPending}>
              {t("clubs.detail.createPlayerSubmit")}
            </button>
            {(playerForm.formState.errors.firstName || playerForm.formState.errors.lastName) && (
              <p style={{ color: "red" }}>{t("clubs.detail.createPlayerError")}</p>
            )}
          </form>
        </div>
      )}

      {canManageTeams && (
        <div style={{ marginTop: 16 }}>
          <h3>{t("clubs.detail.createTeam")}</h3>
          <form
            onSubmit={teamForm.handleSubmit((dto) =>
              createTeam.mutate(dto, { onSuccess: () => teamForm.reset() })
            )}
          >
            <input
              {...teamForm.register("name")}
              placeholder={t("clubs.detail.teamName") ?? ""}
              style={{ marginRight: 8 }}
            />
            <button type="submit" disabled={createTeam.isPending}>
              {t("clubs.detail.createTeamSubmit")}
            </button>
            {teamForm.formState.errors.name && (
              <p style={{ color: "red" }}>{teamForm.formState.errors.name.message}</p>
            )}
          </form>
        </div>
      )}

      {isClubAdmin && (
        <>
          <div style={{ marginTop: 24 }}>
            <h2>{t("clubs.detail.invite")}</h2>
            <form
              onSubmit={inviteForm.handleSubmit((dto) =>
                createInvite.mutate(dto, {
                  onSuccess: () => {
                    inviteForm.reset();
                    setInviteSent(true);
                  },
                })
              )}
            >
              <input
                type="email"
                {...inviteForm.register("email")}
                placeholder={t("clubs.detail.inviteEmail") ?? ""}
                style={{ marginRight: 8 }}
              />
              <select {...inviteForm.register("role")} defaultValue={Role.COACH} style={{ marginRight: 8 }}>
                <option value={Role.COACH}>{t("roles.coach")}</option>
                <option value={Role.CLUB_ADMIN}>{t("roles.clubAdmin")}</option>
              </select>
              <button type="submit" disabled={createInvite.isPending}>
                {t("clubs.detail.inviteSubmit")}
              </button>
              {inviteForm.formState.errors.email && (
                <p style={{ color: "red" }}>{inviteForm.formState.errors.email.message}</p>
              )}
              {createInvite.isError && (
                <p style={{ color: "red" }}>
                  {createInvite.error instanceof ApiError
                    ? createInvite.error.message
                    : t("clubs.detail.inviteError")}
                </p>
              )}
              {inviteSent && <p>{t("clubs.detail.inviteSentHint")}</p>}
            </form>

            <h3>{t("clubs.detail.pendingInvites")}</h3>
            <ul>
              {invites
                ?.filter((invite) => !invite.acceptedAt)
                .map((invite) => (
                  <li key={invite.id}>
                    {invite.email} — {invite.role}
                  </li>
                ))}
              {invites?.filter((i) => !i.acceptedAt).length === 0 && (
                <li>{t("clubs.detail.noPendingInvites")}</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

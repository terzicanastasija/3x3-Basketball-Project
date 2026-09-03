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
    <div className="page">
      <h1>{club.name}</h1>
      {club.city && <p>{club.city}</p>}

      <h2>{t("clubs.detail.teams")}</h2>
      <ul className="list">
        {teams?.map((team) => (
          <li key={team.id}>
            <Link to={`/clubs/${clubId}/teams/${team.id}`}>{team.name}</Link>
          </li>
        ))}
        {teams?.length === 0 && <li className="empty">{t("clubs.detail.noTeams")}</li>}
      </ul>

      {canCreatePlayer && (
        <div className="card section">
          <h3>{t("clubs.detail.createPlayer")}</h3>
          <form
            className="inline-row"
            onSubmit={playerForm.handleSubmit((dto) =>
              createPlayer.mutate(dto, { onSuccess: () => playerForm.reset({ homeClubId: clubId }) })
            )}
          >
            <input
              {...playerForm.register("firstName")}
              placeholder={t("players.detail.firstName") ?? ""}
              className="inline-field"
            />
            <input
              {...playerForm.register("lastName")}
              placeholder={t("players.detail.lastName") ?? ""}
              className="inline-field"
            />
            <button type="submit" className="btn-primary" disabled={createPlayer.isPending}>
              {t("clubs.detail.createPlayerSubmit")}
            </button>
            {(playerForm.formState.errors.firstName || playerForm.formState.errors.lastName) && (
              <span className="field-error">{t("clubs.detail.createPlayerError")}</span>
            )}
          </form>
        </div>
      )}

      {canManageTeams && (
        <div className="card section">
          <h3>{t("clubs.detail.createTeam")}</h3>
          <form
            className="inline-row"
            onSubmit={teamForm.handleSubmit((dto) =>
              createTeam.mutate(dto, { onSuccess: () => teamForm.reset() })
            )}
          >
            <input
              {...teamForm.register("name")}
              placeholder={t("clubs.detail.teamName") ?? ""}
              className="inline-field"
            />
            <button type="submit" className="btn-primary" disabled={createTeam.isPending}>
              {t("clubs.detail.createTeamSubmit")}
            </button>
            {teamForm.formState.errors.name && (
              <span className="field-error">{teamForm.formState.errors.name.message}</span>
            )}
          </form>
        </div>
      )}

      {isClubAdmin && (
        <div className="card section">
          <h2>{t("clubs.detail.invite")}</h2>
          <form
            className="inline-row"
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
              className="inline-field"
            />
            <select {...inviteForm.register("role")} defaultValue={Role.COACH} className="inline-field">
              <option value={Role.COACH}>{t("roles.coach")}</option>
              <option value={Role.CLUB_ADMIN}>{t("roles.clubAdmin")}</option>
            </select>
            <button type="submit" className="btn-primary" disabled={createInvite.isPending}>
              {t("clubs.detail.inviteSubmit")}
            </button>
            {inviteForm.formState.errors.email && (
              <span className="field-error">{inviteForm.formState.errors.email.message}</span>
            )}
            {createInvite.isError && (
              <span className="field-error">
                {createInvite.error instanceof ApiError
                  ? createInvite.error.message
                  : t("clubs.detail.inviteError")}
              </span>
            )}
            {inviteSent && <span className="hint">{t("clubs.detail.inviteSentHint")}</span>}
          </form>

          <h3 style={{ marginTop: 20 }}>{t("clubs.detail.pendingInvites")}</h3>
          <ul className="list">
            {invites
              ?.filter((invite) => !invite.acceptedAt)
              .map((invite) => (
                <li key={invite.id} style={{ padding: "10px 16px" }}>
                  {invite.email} — <span className="badge">{invite.role}</span>
                </li>
              ))}
            {invites?.filter((i) => !i.acceptedAt).length === 0 && (
              <li className="empty">{t("clubs.detail.noPendingInvites")}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

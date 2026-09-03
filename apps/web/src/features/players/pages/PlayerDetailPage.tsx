import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Handedness, updatePlayerSchema, UpdatePlayerDto } from "@3x3/shared";
import { useDeletePlayer, usePlayer, useUpdatePlayer } from "../api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function PlayerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playerId } = useParams<{ playerId: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: player, isLoading } = usePlayer(playerId);
  const updatePlayer = useUpdatePlayer(playerId ?? "");
  const deletePlayer = useDeletePlayer(playerId ?? "");

  // UI-level gating only — the real authority is the server, which requires an Admin
  // (superadmin) for player-record management, per the RBAC overhaul (see PROGRESS.md).
  const canEdit = currentUser?.isSuperadmin;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePlayerDto>({ resolver: zodResolver(updatePlayerSchema) });

  useEffect(() => {
    if (player) {
      reset({
        firstName: player.firstName,
        lastName: player.lastName,
        dateOfBirth: player.dateOfBirth ? (player.dateOfBirth.slice(0, 10) as unknown as Date) : undefined,
        heightCm: player.heightCm ?? undefined,
        position: player.position ?? undefined,
        dominantHand: player.dominantHand as Handedness,
      });
    }
  }, [player, reset]);

  function handleDelete() {
    if (!player) return;
    if (!window.confirm(t("players.detail.deleteConfirm", { name: `${player.firstName} ${player.lastName}` }))) {
      return;
    }
    deletePlayer.mutate(undefined, { onSuccess: () => navigate("/players") });
  }

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!player) return <p>{t("players.notFound")}</p>;

  return (
    <div className="page page-narrow">
      <h1>
        {player.firstName} {player.lastName}
      </h1>
      <div className="card">
        <ul>
          <li>{t("players.detail.club")}: {player.homeClub?.name ?? t("players.detail.noClub")}</li>
          <li>
            {t("players.detail.dateOfBirth")}:{" "}
            {player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString() : "—"}
          </li>
          <li>{t("players.detail.age")}: {player.dateOfBirth ? calculateAge(player.dateOfBirth) : "—"}</li>
          <li>{t("players.detail.position")}: {player.position ?? "—"}</li>
          <li>{t("players.detail.height")}: {player.heightCm ? `${player.heightCm} cm` : "—"}</li>
          <li>{t("players.detail.hand")}: {player.dominantHand}</li>
        </ul>
        <Link to={`/players/${player.id}/dashboard`}>{t("players.detail.viewDashboard")}</Link>
      </div>

      {canEdit && (
        <div className="card">
          <button className="btn-danger btn-small" onClick={handleDelete} disabled={deletePlayer.isPending}>
            {t("players.detail.delete")}
          </button>
          {deletePlayer.isError && (
            <p className="field-error">
              {deletePlayer.error instanceof ApiError ? deletePlayer.error.message : t("players.detail.deleteError")}
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="card section">
          <h2>{t("players.detail.editTitle")}</h2>
          <form onSubmit={handleSubmit((dto) => updatePlayer.mutate(dto))}>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.firstName")}
                <input {...register("firstName")} />
              </label>
              {errors.firstName && <span className="field-error">{errors.firstName.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.lastName")}
                <input {...register("lastName")} />
              </label>
              {errors.lastName && <span className="field-error">{errors.lastName.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.dateOfBirth")}
                <input type="date" {...register("dateOfBirth")} />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.height")}
                <input type="number" {...register("heightCm")} />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.position")}
                <input {...register("position")} />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.hand")}
                <select {...register("dominantHand")}>
                  {Object.values(Handedness).map((hand) => (
                    <option key={hand} value={hand}>
                      {hand}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {updatePlayer.isError && (
              <p className="field-error">
                {updatePlayer.error instanceof ApiError
                  ? updatePlayer.error.message
                  : t("players.detail.editError")}
              </p>
            )}
            {updatePlayer.isSuccess && <p className="hint">{t("players.detail.editSuccess")}</p>}
            <button type="submit" className="btn-primary" disabled={updatePlayer.isPending}>
              {t("players.detail.editSubmit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

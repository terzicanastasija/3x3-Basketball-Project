import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Handedness, updatePlayerSchema, UpdatePlayerDto } from "@3x3/shared";
import { usePlayer, useUpdatePlayer } from "../api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";
import { NavBar } from "../../../components/NavBar";

export function PlayerDetailPage() {
  const { t } = useTranslation();
  const { playerId } = useParams<{ playerId: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: player, isLoading } = usePlayer(playerId);
  const updatePlayer = useUpdatePlayer(playerId ?? "");

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
        heightCm: player.heightCm ?? undefined,
        position: player.position ?? undefined,
        dominantHand: player.dominantHand as Handedness,
      });
    }
  }, [player, reset]);

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!player) return <p>{t("players.notFound")}</p>;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>
        {player.firstName} {player.lastName}
      </h1>
      <ul>
        <li>{t("players.detail.club")}: {player.homeClub?.name ?? t("players.detail.noClub")}</li>
        <li>{t("players.detail.position")}: {player.position ?? "—"}</li>
        <li>{t("players.detail.height")}: {player.heightCm ? `${player.heightCm} cm` : "—"}</li>
        <li>{t("players.detail.hand")}: {player.dominantHand}</li>
      </ul>
      <p>
        <Link to={`/players/${player.id}/dashboard`}>{t("players.detail.viewDashboard")}</Link>
      </p>

      {canEdit && (
        <div style={{ marginTop: 24 }}>
          <h2>{t("players.detail.editTitle")}</h2>
          <form onSubmit={handleSubmit((dto) => updatePlayer.mutate(dto))}>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.firstName")}
                <input {...register("firstName")} style={{ display: "block", width: "100%" }} />
              </label>
              {errors.firstName && <span style={{ color: "red" }}>{errors.firstName.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.lastName")}
                <input {...register("lastName")} style={{ display: "block", width: "100%" }} />
              </label>
              {errors.lastName && <span style={{ color: "red" }}>{errors.lastName.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.height")}
                <input
                  type="number"
                  {...register("heightCm")}
                  style={{ display: "block", width: "100%" }}
                />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.position")}
                <input {...register("position")} style={{ display: "block", width: "100%" }} />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("players.detail.hand")}
                <select {...register("dominantHand")} style={{ display: "block", width: "100%" }}>
                  {Object.values(Handedness).map((hand) => (
                    <option key={hand} value={hand}>
                      {hand}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {updatePlayer.isError && (
              <p style={{ color: "red" }}>
                {updatePlayer.error instanceof ApiError
                  ? updatePlayer.error.message
                  : t("players.detail.editError")}
              </p>
            )}
            {updatePlayer.isSuccess && <p>{t("players.detail.editSuccess")}</p>}
            <button type="submit" disabled={updatePlayer.isPending}>
              {t("players.detail.editSubmit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

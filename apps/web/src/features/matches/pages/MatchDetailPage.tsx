import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { MatchEndType, recordMatchResultSchema, RecordMatchResultDto } from "@3x3/shared";
import { useMatch, useRecordMatchResult } from "../api";
import { useTeam } from "../../teams/api";
import { useCurrentUser } from "../../auth/api";
import { useStatRecomputeStatus } from "../../dashboards/api";
import { ApiError } from "../../../lib/api-client";
import { NavBar } from "../../../components/NavBar";

export function MatchDetailPage() {
  const { t } = useTranslation();
  const { matchId } = useParams<{ matchId: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: match, isLoading } = useMatch(matchId);
  const { data: homeTeam } = useTeam(match?.homeTeamId);
  const { data: awayTeam } = useTeam(match?.awayTeamId);
  const recordResult = useRecordMatchResult(matchId ?? "");
  // Only poll once the match is actually locked — a stat-recompute job is only ever
  // enqueued on first lock, so polling before that would just spin forever.
  const { data: recomputeStatus } = useStatRecomputeStatus(matchId, {
    enabled: Boolean(match?.lockedAt),
  });

  // UI-level gating only — the real authority is the server, which requires an Admin
  // (superadmin) for match results, per the RBAC overhaul (see PROGRESS.md).
  const canRecordResult = currentUser?.isSuperadmin;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordMatchResultDto>({
    resolver: zodResolver(recordMatchResultSchema),
    defaultValues: {
      homeScore: 0,
      awayScore: 0,
      homeTeamFouls: 0,
      awayTeamFouls: 0,
      endType: MatchEndType.REGULAR_TIME,
    },
  });

  // useForm's defaultValues are captured once at mount, when `match` is still undefined
  // (it loads async) — reset() re-syncs the form once the real values arrive, so editing an
  // already-PLAYED match's result shows its current values instead of blank zeros.
  useEffect(() => {
    if (match) {
      reset({
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
        homeTeamFouls: match.homeTeamFouls,
        awayTeamFouls: match.awayTeamFouls,
        endType: (match.endType as MatchEndType) ?? MatchEndType.REGULAR_TIME,
      });
    }
  }, [match, reset]);

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!match) return <p>{t("matches.notFound")}</p>;

  const isPlayed = match.status === "PLAYED";

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      {match.phase && <p>{t(`matchPhase.${match.phase}`)}</p>}
      <h1>
        {homeTeam?.name ?? "…"} {t("matches.detail.vs")} {awayTeam?.name ?? "…"}
      </h1>
      <p>{t("matches.detail.status")}: {match.status}</p>
      {match.scheduledAt && <p>{new Date(match.scheduledAt).toLocaleString()}</p>}
      <p>
        <Link to={`/matches/${match.id}/tag`}>
          {match.lockedAt ? t("matches.detail.viewTags") : t("matches.detail.tagMatch")}
        </Link>
      </p>

      {match.lockedAt && (
        <p>
          {recomputeStatus?.ready ? (
            <Link to={`/matches/${match.id}/dashboard`}>{t("matches.detail.viewDashboard")}</Link>
          ) : (
            t("matches.detail.computingStats")
          )}
        </p>
      )}

      {isPlayed && (
        <div style={{ marginTop: 16 }}>
          <h2>{t("matches.detail.result")}</h2>
          <p>
            {match.homeScore} : {match.awayScore} ({match.endType})
          </p>
          <p>
            {t("matches.detail.fouls")}: {match.homeTeamFouls} / {match.awayTeamFouls}
          </p>
        </div>
      )}

      {canRecordResult && (
        <div style={{ marginTop: 24 }}>
          <h2>{isPlayed ? t("matches.detail.editResult") : t("matches.detail.recordResult")}</h2>
          <form onSubmit={handleSubmit((dto) => recordResult.mutate(dto))}>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <label>
                {t("matches.detail.homeScore")}
                <input type="number" {...register("homeScore")} style={{ display: "block", width: 80 }} />
              </label>
              <label>
                {t("matches.detail.awayScore")}
                <input type="number" {...register("awayScore")} style={{ display: "block", width: 80 }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <label>
                {t("matches.detail.homeFouls")}
                <input
                  type="number"
                  {...register("homeTeamFouls")}
                  style={{ display: "block", width: 80 }}
                />
              </label>
              <label>
                {t("matches.detail.awayFouls")}
                <input
                  type="number"
                  {...register("awayTeamFouls")}
                  style={{ display: "block", width: 80 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("matches.detail.endType")}
                <select {...register("endType")} style={{ display: "block" }}>
                  {Object.values(MatchEndType).map((endType) => (
                    <option key={endType} value={endType}>
                      {endType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(errors.homeScore || errors.awayScore || errors.homeTeamFouls || errors.awayTeamFouls) && (
              <p style={{ color: "red" }}>{t("matches.detail.validationError")}</p>
            )}
            {recordResult.isError && (
              <p style={{ color: "red" }}>
                {recordResult.error instanceof ApiError
                  ? recordResult.error.message
                  : t("matches.detail.resultError")}
              </p>
            )}
            <button type="submit" disabled={recordResult.isPending}>
              {t("matches.detail.submitResult")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

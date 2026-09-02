import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { createMatchSchema, CreateMatchDto, MatchPhase } from "@3x3/shared";
import { useTournament } from "../api";
import { useCreateMatch, useMatchesForTournament } from "../../matches/api";
import { useClubs } from "../../clubs/api";
import { useTeam, useTeamsForClub } from "../../teams/api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";
import { NavBar } from "../../../components/NavBar";

// A match only stores homeTeamId/awayTeamId, not each team's clubId, so the roster-builder
// deep link (which needs :clubId) is resolved per-team via this small lookup component
// rather than adding a new backend endpoint just for this link.
function TeamRosterLink({ teamId, tournamentId }: { teamId: string; tournamentId: string }) {
  const { t } = useTranslation();
  const { data: team } = useTeam(teamId);
  if (!team) return null;
  return (
    <li>
      <Link to={`/clubs/${team.clubId}/teams/${team.id}?tournamentId=${tournamentId}`}>
        {team.name} — {t("tournaments.detail.manageRoster")}
      </Link>
    </li>
  );
}

// Same "resolve names via the existing per-team lookup" approach as TeamRosterLink above — a
// match only stores homeTeamId/awayTeamId, not either team's display name.
function MatchListItem({ match }: { match: { id: string; homeTeamId: string; awayTeamId: string; phase: string | null; status: string; homeScore: number | null; awayScore: number | null } }) {
  const { t } = useTranslation();
  const { data: homeTeam } = useTeam(match.homeTeamId);
  const { data: awayTeam } = useTeam(match.awayTeamId);
  return (
    <li>
      <Link to={`/matches/${match.id}`}>
        {match.phase && `${t(`matchPhase.${match.phase}`)} — `}
        {homeTeam?.name ?? "…"} {t("matches.detail.vs")} {awayTeam?.name ?? "…"}
        {match.status === "PLAYED" ? ` — ${match.homeScore} : ${match.awayScore}` : ` — ${match.status}`}
      </Link>
    </li>
  );
}

export function TournamentDetailPage() {
  const { t } = useTranslation();
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: matches } = useMatchesForTournament(tournamentId);
  const createMatch = useCreateMatch(tournamentId ?? "");
  const { data: clubs } = useClubs();

  const [homeClubId, setHomeClubId] = useState("");
  const [awayClubId, setAwayClubId] = useState("");
  const { data: homeTeams } = useTeamsForClub(homeClubId || undefined);
  const { data: awayTeams } = useTeamsForClub(awayClubId || undefined);

  const participatingTeamIds = useMemo(() => {
    const ids = new Set<string>();
    matches?.forEach((m) => {
      ids.add(m.homeTeamId);
      ids.add(m.awayTeamId);
    });
    return Array.from(ids);
  }, [matches]);

  // UI-level gating only — the real authority is the server, which requires an Admin
  // (superadmin) for match scheduling, per the RBAC overhaul (see PROGRESS.md).
  const canCreateMatch = currentUser?.isSuperadmin;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMatchDto>({ resolver: zodResolver(createMatchSchema) });

  const onSubmit = (dto: CreateMatchDto) => {
    createMatch.mutate(dto, {
      onSuccess: () => {
        reset();
        setHomeClubId("");
        setAwayClubId("");
      },
    });
  };

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!tournament) return <p>{t("tournaments.notFound")}</p>;

  return (
    <div className="page">
      <NavBar />
      <h1>{tournament.name}</h1>
      {tournament.location && <p>{tournament.location}</p>}
      <p className="hint">{new Date(tournament.startDate).toLocaleDateString()}</p>

      <h2>{t("tournaments.detail.matches")}</h2>
      <ul className="list">
        {matches?.map((match) => (
          <MatchListItem key={match.id} match={match} />
        ))}
        {matches?.length === 0 && <li className="empty">{t("tournaments.detail.noMatches")}</li>}
      </ul>

      {participatingTeamIds.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>{t("tournaments.detail.rosters")}</h2>
          <ul className="list">
            {participatingTeamIds.map((teamId) => (
              <TeamRosterLink key={teamId} teamId={teamId} tournamentId={tournamentId ?? ""} />
            ))}
          </ul>
        </>
      )}

      {canCreateMatch && (
        <div className="card section">
          <h2>{t("tournaments.detail.createMatch")}</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label>
                  {t("tournaments.detail.homeClub")}
                  <select value={homeClubId} onChange={(e) => setHomeClubId(e.target.value)}>
                    <option value="">{t("tournaments.detail.selectClub")}</option>
                    {clubs?.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ marginTop: 10 }}>
                  {t("tournaments.detail.homeTeam")}
                  <select {...register("homeTeamId")}>
                    <option value="">{t("tournaments.detail.selectTeam")}</option>
                    {homeTeams?.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label>
                  {t("tournaments.detail.awayClub")}
                  <select value={awayClubId} onChange={(e) => setAwayClubId(e.target.value)}>
                    <option value="">{t("tournaments.detail.selectClub")}</option>
                    {clubs?.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ marginTop: 10 }}>
                  {t("tournaments.detail.awayTeam")}
                  <select {...register("awayTeamId")}>
                    <option value="">{t("tournaments.detail.selectTeam")}</option>
                    {awayTeams?.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <label style={{ marginTop: 10 }}>
              {t("tournaments.detail.phase")}
              <select {...register("phase")}>
                <option value="">{t("tournaments.detail.noPhase")}</option>
                {Object.values(MatchPhase).map((phase) => (
                  <option key={phase} value={phase}>
                    {t(`matchPhase.${phase}`)}
                  </option>
                ))}
              </select>
            </label>
            {(errors.homeTeamId || errors.awayTeamId) && (
              <p className="field-error">{t("tournaments.detail.matchTeamError")}</p>
            )}
            {createMatch.isError && (
              <p className="field-error">
                {createMatch.error instanceof ApiError
                  ? createMatch.error.message
                  : t("tournaments.detail.createMatchError")}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={createMatch.isPending} style={{ marginTop: 12 }}>
              {t("tournaments.detail.createMatchSubmit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

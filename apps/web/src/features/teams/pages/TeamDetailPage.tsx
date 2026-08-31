import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useTeam } from "../api";
import { useTournaments } from "../../tournaments/api";
import {
  useAddRosterPlayer,
  useCreateOrGetRoster,
  useRemoveRosterPlayer,
  useRoster,
} from "../../rosters/api";
import { usePlayers } from "../../players/api";
import { NavBar } from "../../../components/NavBar";

export function TeamDetailPage() {
  const { t } = useTranslation();
  const { teamId } = useParams<{ teamId: string; clubId: string }>();
  const { data: team, isLoading: teamLoading } = useTeam(teamId);
  const { data: tournaments } = useTournaments();
  const [searchParams] = useSearchParams();
  // Pre-selects the tournament when arriving via a "manage roster" link from the tournament
  // detail page (?tournamentId=...); still freely changeable via the picker below.
  const [tournamentId, setTournamentId] = useState<string>(searchParams.get("tournamentId") ?? "");

  const { data: roster, isLoading: rosterLoading } = useRoster(teamId, tournamentId || undefined);
  const createOrGetRoster = useCreateOrGetRoster(teamId ?? "");
  const addPlayer = useAddRosterPlayer(teamId ?? "", tournamentId);
  const removePlayer = useRemoveRosterPlayer(teamId ?? "", tournamentId);

  const { data: candidatePlayers } = usePlayers(team ? { clubId: team.clubId } : {});
  const rosterPlayerIds = useMemo(
    () => new Set(roster?.players.map((p) => p.playerId) ?? []),
    [roster]
  );
  const availablePlayers = candidatePlayers?.filter((p) => !rosterPlayerIds.has(p.id)) ?? [];

  if (teamLoading) return <p>{t("home.loading")}</p>;
  if (!team) return <p>{t("teams.notFound")}</p>;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{team.name}</h1>

      <h2>{t("teams.roster.tournamentPicker")}</h2>
      <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
        <option value="">{t("teams.roster.selectTournament")}</option>
        {tournaments?.map((tournament) => (
          <option key={tournament.id} value={tournament.id}>
            {tournament.name}
          </option>
        ))}
      </select>

      {tournamentId && (
        <div style={{ marginTop: 16 }}>
          <p>
            <Link to={`/teams/${teamId}/dashboard?tournamentId=${tournamentId}`}>
              {t("teams.roster.viewDashboard")}
            </Link>
          </p>
          <h2>{t("teams.roster.title")}</h2>
          {rosterLoading && <p>{t("home.loading")}</p>}

          {!rosterLoading && !roster && (
            <div>
              <p>{t("teams.roster.none")}</p>
              <button
                onClick={() => createOrGetRoster.mutate(tournamentId)}
                disabled={createOrGetRoster.isPending}
              >
                {t("teams.roster.create")}
              </button>
            </div>
          )}

          {roster && (
            <>
              <ul>
                {roster.players.map((entry) => (
                  <li key={entry.id}>
                    {`#${entry.jerseyNumber ?? "-"} ${entry.player.firstName} ${entry.player.lastName}`}{" "}
                    <button onClick={() => removePlayer.mutate(entry.playerId)}>
                      {t("teams.roster.remove")}
                    </button>
                  </li>
                ))}
                {roster.players.length === 0 && <li>{t("teams.roster.empty")}</li>}
              </ul>

              <h3>{t("teams.roster.addPlayer")}</h3>
              <ul>
                {availablePlayers.map((player) => (
                  <li key={player.id}>
                    {`${player.firstName} ${player.lastName}`}{" "}
                    <button onClick={() => addPlayer.mutate({ playerId: player.id })}>
                      {t("teams.roster.add")}
                    </button>
                  </li>
                ))}
                {availablePlayers.length === 0 && <li>{t("teams.roster.noCandidates")}</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

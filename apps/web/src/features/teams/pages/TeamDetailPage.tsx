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
import { useCurrentUser } from "../../auth/api";

export function TeamDetailPage() {
  const { t } = useTranslation();
  const { teamId } = useParams<{ teamId: string; clubId: string }>();
  const { data: currentUser } = useCurrentUser();
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

  // UI-level gating only — the real authority is the server, which requires an Admin
  // (superadmin) for roster management, per the RBAC overhaul (see PROGRESS.md). Viewing the
  // roster stays open to anyone with access to the team's club.
  const canManageRoster = currentUser?.isSuperadmin;

  if (teamLoading) return <p>{t("home.loading")}</p>;
  if (!team) return <p>{t("teams.notFound")}</p>;

  return (
    <div className="page">
      <h1>{team.name}</h1>

      <h2>{t("teams.roster.tournamentPicker")}</h2>
      <select
        value={tournamentId}
        onChange={(e) => setTournamentId(e.target.value)}
        className="inline-field"
        style={{ minWidth: 260 }}
      >
        <option value="">{t("teams.roster.selectTournament")}</option>
        {tournaments?.map((tournament) => (
          <option key={tournament.id} value={tournament.id}>
            {tournament.name}
          </option>
        ))}
      </select>

      {tournamentId && (
        <div className="card section">
          <p>
            <Link to={`/teams/${teamId}/dashboard?tournamentId=${tournamentId}`}>
              {t("teams.roster.viewDashboard")}
            </Link>
          </p>
          <h2>{t("teams.roster.title")}</h2>
          {rosterLoading && <p>{t("home.loading")}</p>}

          {!rosterLoading && !roster && canManageRoster && (
            <div>
              <p>{t("teams.roster.none")}</p>
              <button
                className="btn-primary"
                onClick={() => createOrGetRoster.mutate(tournamentId)}
                disabled={createOrGetRoster.isPending}
              >
                {t("teams.roster.create")}
              </button>
            </div>
          )}
          {!rosterLoading && !roster && !canManageRoster && <p>{t("teams.roster.none")}</p>}

          {roster && (
            <>
              <ul>
                {roster.players.map((entry) => (
                  <li
                    key={entry.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <span>
                      <span className="badge">#{entry.jerseyNumber ?? "-"}</span>{" "}
                      {entry.player.firstName} {entry.player.lastName}
                    </span>
                    {canManageRoster && (
                      <button className="btn-danger btn-small" onClick={() => removePlayer.mutate(entry.playerId)}>
                        {t("teams.roster.remove")}
                      </button>
                    )}
                  </li>
                ))}
                {roster.players.length === 0 && <li>{t("teams.roster.empty")}</li>}
              </ul>

              {canManageRoster && (
                <>
                  <h3 style={{ marginTop: 20 }}>{t("teams.roster.addPlayer")}</h3>
                  <ul>
                    {availablePlayers.map((player) => (
                      <li
                        key={player.id}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                      >
                        <span>
                          {player.firstName} {player.lastName}
                        </span>
                        <button className="btn-small" onClick={() => addPlayer.mutate({ playerId: player.id })}>
                          {t("teams.roster.add")}
                        </button>
                      </li>
                    ))}
                    {availablePlayers.length === 0 && <li>{t("teams.roster.noCandidates")}</li>}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

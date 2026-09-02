import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTournaments } from "../../tournaments/api";
import { useMatchesForTournament } from "../../matches/api";
import { useTeams } from "../../teams/api";
import { NavBar } from "../../../components/NavBar";

// The Scout's entry point into tagging: pick a Tournament, then pick one of its existing
// Matches, then jump to the real tagging screen. Scouts never create tournaments/matches
// themselves (that's Admin-only) — this page only ever selects from what already exists.
export function SelectMatchToTagPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: tournaments } = useTournaments();
  const [tournamentId, setTournamentId] = useState("");
  const { data: matches } = useMatchesForTournament(tournamentId || undefined);

  // <option> labels must be plain strings — no per-row lookup component like a list item could
  // use — so team names for every match in view are resolved up front into a lookup map.
  const teamIds = useMemo(() => {
    const ids = new Set<string>();
    matches?.forEach((m) => {
      ids.add(m.homeTeamId);
      ids.add(m.awayTeamId);
    });
    return Array.from(ids);
  }, [matches]);
  const teamQueries = useTeams(teamIds);
  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    teamIds.forEach((id, i) => {
      const name = teamQueries[i]?.data?.name;
      if (name) map.set(id, name);
    });
    return map;
  }, [teamIds, teamQueries]);

  return (
    <div className="page page-narrow">
      <NavBar />
      <h1>{t("tagging.select.title")}</h1>

      <div className="card">
        <div style={{ marginBottom: 12 }}>
          <label>
            {t("tagging.select.tournament")}
            <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
              <option value="">{t("tagging.select.selectTournament")}</option>
              {tournaments?.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tournamentId && (
          <div style={{ marginBottom: 12 }}>
            <label>
              {t("tagging.select.match")}
              <select
                defaultValue=""
                onChange={(e) => e.target.value && navigate(`/matches/${e.target.value}/tag`)}
              >
                <option value="">{t("tagging.select.selectMatch")}</option>
                {matches?.map((match) => {
                  const home = teamNameById.get(match.homeTeamId) ?? "…";
                  const away = teamNameById.get(match.awayTeamId) ?? "…";
                  const phase = match.phase ? `${t(`matchPhase.${match.phase}`)} — ` : "";
                  const result =
                    match.status === "PLAYED" ? ` (${match.homeScore} : ${match.awayScore})` : ` — ${match.status}`;
                  return (
                    <option key={match.id} value={match.id}>
                      {phase}
                      {home} {t("matches.detail.vs")} {away}
                      {result}
                    </option>
                  );
                })}
              </select>
            </label>
            {matches?.length === 0 && <p className="hint">{t("tagging.select.noMatches")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

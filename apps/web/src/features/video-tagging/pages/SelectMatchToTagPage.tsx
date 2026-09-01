import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTournaments } from "../../tournaments/api";
import { useMatchesForTournament } from "../../matches/api";
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

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{t("tagging.select.title")}</h1>

      <div style={{ marginBottom: 12 }}>
        <label>
          {t("tagging.select.tournament")}
          <select
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            style={{ display: "block", width: "100%" }}
          >
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
              style={{ display: "block", width: "100%" }}
            >
              <option value="">{t("tagging.select.selectMatch")}</option>
              {matches?.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.status === "PLAYED"
                    ? `${match.homeScore} : ${match.awayScore}`
                    : t("tournaments.detail.scheduled")}
                  {" — "}
                  {match.status}
                </option>
              ))}
            </select>
          </label>
          {matches?.length === 0 && <p>{t("tagging.select.noMatches")}</p>}
        </div>
      )}
    </div>
  );
}

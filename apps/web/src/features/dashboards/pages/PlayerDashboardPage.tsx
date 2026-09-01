import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlayer } from "../../players/api";
import { usePlayerDashboard } from "../api";
import { NavBar } from "../../../components/NavBar";

export function PlayerDashboardPage() {
  const { t } = useTranslation();
  const { playerId } = useParams<{ playerId: string }>();
  const { data: player } = usePlayer(playerId);
  const { data, isLoading } = usePlayerDashboard(playerId);

  if (isLoading) return <p>{t("home.loading")}</p>;

  const ppg =
    data?.career && data.career.gamesPlayed > 0
      ? (data.career.points / data.career.gamesPlayed).toFixed(1)
      : null;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>
        {player?.firstName} {player?.lastName} — {t("dashboards.player.title")}
      </h1>

      <h2>{t("dashboards.player.career")}</h2>
      {!data?.career && <p>{t("dashboards.player.noCareerStats")}</p>}
      {data?.career && (
        <ul>
          <li>
            {t("dashboards.player.ppg")}: {ppg}
          </li>
          <li>
            {t("dashboards.table.points")}: {data.career.points}
          </li>
          <li>
            {t("dashboards.table.rebounds")}: {data.career.offRebounds + data.career.defRebounds}
          </li>
          <li>
            {t("dashboards.table.assists")}: {data.career.assists}
          </li>
          <li>
            {t("dashboards.team.gamesPlayed")}: {data.career.gamesPlayed}
          </li>
        </ul>
      )}

      <h2>{t("dashboards.player.matchHistory")}</h2>
      {(!data || data.matches.length === 0) && <p>{t("dashboards.player.noMatches")}</p>}
      {data && data.matches.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t("dashboards.table.points")}</th>
              <th style={{ textAlign: "left" }}>{t("dashboards.table.rebounds")}</th>
              <th style={{ textAlign: "left" }}>{t("dashboards.table.assists")}</th>
              <th style={{ textAlign: "left" }}></th>
            </tr>
          </thead>
          <tbody>
            {data.matches.map((row) => (
              <tr key={row.id}>
                <td>{row.points}</td>
                <td>{row.offRebounds + row.defRebounds}</td>
                <td>{row.assists}</td>
                <td>
                  <Link to={`/matches/${row.match.id}/tag`}>{t("dashboards.player.viewTagsAndClips")}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

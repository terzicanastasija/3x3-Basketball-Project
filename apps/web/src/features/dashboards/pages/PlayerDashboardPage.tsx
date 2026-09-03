import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlayer } from "../../players/api";
import { usePlayerDashboard } from "../api";

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
    <div className="page">
      <h1>
        {player?.firstName} {player?.lastName} — {t("dashboards.player.title")}
      </h1>

      <h2>{t("dashboards.player.career")}</h2>
      {!data?.career && <p>{t("dashboards.player.noCareerStats")}</p>}
      {data?.career && (
        <ul className="card">
          <li>
            {t("dashboards.player.ppg")}: <strong>{ppg}</strong>
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

      <h2 style={{ marginTop: 24 }}>{t("dashboards.player.matchHistory")}</h2>
      {(!data || data.matches.length === 0) && <p>{t("dashboards.player.noMatches")}</p>}
      {data && data.matches.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{t("dashboards.table.points")}</th>
                <th>{t("dashboards.table.rebounds")}</th>
                <th>{t("dashboards.table.assists")}</th>
                <th></th>
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
        </div>
      )}
    </div>
  );
}

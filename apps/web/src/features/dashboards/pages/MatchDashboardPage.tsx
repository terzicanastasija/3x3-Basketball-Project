import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMatchDashboard } from "../api";
import { NavBar } from "../../../components/NavBar";

export function MatchDashboardPage() {
  const { t } = useTranslation();
  const { matchId } = useParams<{ matchId: string }>();
  const { data: rows, isLoading } = useMatchDashboard(matchId);

  if (isLoading) return <p>{t("home.loading")}</p>;

  const playerRows = rows?.filter((r) => r.player) ?? [];
  const teamRows = rows?.filter((r) => r.team) ?? [];

  return (
    <div className="page page-wide">
      <NavBar />
      <h1>{t("dashboards.match.title")}</h1>
      <p>
        <Link to={`/matches/${matchId}/tag`}>{t("dashboards.match.viewTagsAndClips")}</Link>
      </p>

      {rows?.length === 0 && <p>{t("dashboards.match.empty")}</p>}

      {teamRows.length > 0 && (
        <div className="section" style={{ overflowX: "auto" }}>
          <h2>{t("dashboards.match.teams")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("dashboards.table.name")}</th>
                <th>{t("dashboards.table.points")}</th>
                <th>{t("dashboards.table.shots2pt")}</th>
                <th>{t("dashboards.table.assists")}</th>
                <th>{t("dashboards.table.fouls")}</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.team?.name}</td>
                  <td>{row.points}</td>
                  <td>
                    {row.shots2ptMade}/{row.shots2ptAtt}
                  </td>
                  <td>{row.assists}</td>
                  <td>{row.personalFouls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {playerRows.length > 0 && (
        <div className="section" style={{ overflowX: "auto" }}>
          <h2>{t("dashboards.match.players")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("dashboards.table.name")}</th>
                <th>{t("dashboards.table.points")}</th>
                <th>{t("dashboards.table.shots2pt")}</th>
                <th>{t("dashboards.table.shots1pt")}</th>
                <th>{t("dashboards.table.ft")}</th>
                <th>{t("dashboards.table.rebounds")}</th>
                <th>{t("dashboards.table.assists")}</th>
                <th>{t("dashboards.table.steals")}</th>
                <th>{t("dashboards.table.blocks")}</th>
                <th>{t("dashboards.table.fouls")}</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.player?.firstName} {row.player?.lastName}
                  </td>
                  <td>{row.points}</td>
                  <td>
                    {row.shots2ptMade}/{row.shots2ptAtt}
                  </td>
                  <td>
                    {row.shots1ptMade}/{row.shots1ptAtt}
                  </td>
                  <td>
                    {row.ftMade}/{row.ftAtt}
                  </td>
                  <td>{row.offRebounds + row.defRebounds}</td>
                  <td>{row.assists}</td>
                  <td>{row.steals}</td>
                  <td>{row.blocks}</td>
                  <td>{row.personalFouls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

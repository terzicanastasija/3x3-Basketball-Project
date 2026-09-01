import type { CSSProperties } from "react";
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
    <div style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{t("dashboards.match.title")}</h1>
      <p>
        <Link to={`/matches/${matchId}/tag`}>{t("dashboards.match.viewTagsAndClips")}</Link>
      </p>

      {rows?.length === 0 && <p>{t("dashboards.match.empty")}</p>}

      {teamRows.length > 0 && (
        <>
          <h2>{t("dashboards.match.teams")}</h2>
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={cellStyle}>{t("dashboards.table.name")}</th>
                <th style={cellStyle}>{t("dashboards.table.points")}</th>
                <th style={cellStyle}>{t("dashboards.table.shots2pt")}</th>
                <th style={cellStyle}>{t("dashboards.table.assists")}</th>
                <th style={cellStyle}>{t("dashboards.table.fouls")}</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((row) => (
                <tr key={row.id}>
                  <td style={cellStyle}>{row.team?.name}</td>
                  <td style={cellStyle}>{row.points}</td>
                  <td style={cellStyle}>
                    {row.shots2ptMade}/{row.shots2ptAtt}
                  </td>
                  <td style={cellStyle}>{row.assists}</td>
                  <td style={cellStyle}>{row.personalFouls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {playerRows.length > 0 && (
        <>
          <h2>{t("dashboards.match.players")}</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={cellStyle}>{t("dashboards.table.name")}</th>
                <th style={cellStyle}>{t("dashboards.table.points")}</th>
                <th style={cellStyle}>{t("dashboards.table.shots2pt")}</th>
                <th style={cellStyle}>{t("dashboards.table.shots1pt")}</th>
                <th style={cellStyle}>{t("dashboards.table.ft")}</th>
                <th style={cellStyle}>{t("dashboards.table.rebounds")}</th>
                <th style={cellStyle}>{t("dashboards.table.assists")}</th>
                <th style={cellStyle}>{t("dashboards.table.steals")}</th>
                <th style={cellStyle}>{t("dashboards.table.blocks")}</th>
                <th style={cellStyle}>{t("dashboards.table.fouls")}</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((row) => (
                <tr key={row.id}>
                  <td style={cellStyle}>
                    {row.player?.firstName} {row.player?.lastName}
                  </td>
                  <td style={cellStyle}>{row.points}</td>
                  <td style={cellStyle}>
                    {row.shots2ptMade}/{row.shots2ptAtt}
                  </td>
                  <td style={cellStyle}>
                    {row.shots1ptMade}/{row.shots1ptAtt}
                  </td>
                  <td style={cellStyle}>
                    {row.ftMade}/{row.ftAtt}
                  </td>
                  <td style={cellStyle}>{row.offRebounds + row.defRebounds}</td>
                  <td style={cellStyle}>{row.assists}</td>
                  <td style={cellStyle}>{row.steals}</td>
                  <td style={cellStyle}>{row.blocks}</td>
                  <td style={cellStyle}>{row.personalFouls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const cellStyle: CSSProperties = {
  border: "1px solid #ccc",
  padding: "4px 8px",
  textAlign: "left",
};

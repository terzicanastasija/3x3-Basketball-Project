import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTeam } from "../../teams/api";
import { useTeamDashboard } from "../api";
import { NavBar } from "../../../components/NavBar";

export function TeamDashboardPage() {
  const { t } = useTranslation();
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") ?? undefined;
  const { data: team } = useTeam(teamId);
  const { data: stats, isLoading } = useTeamDashboard(teamId, tournamentId);

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>
        {team?.name ?? "…"} — {t("dashboards.team.title")}
      </h1>

      {!tournamentId && <p>{t("dashboards.team.noTournament")}</p>}
      {tournamentId && isLoading && <p>{t("home.loading")}</p>}
      {tournamentId && !isLoading && !stats && <p>{t("dashboards.team.empty")}</p>}

      {stats && (
        <ul>
          <li>
            {t("dashboards.table.points")}: {stats.points}
          </li>
          <li>
            {t("dashboards.table.shots2pt")}: {stats.shots2ptMade}/{stats.shots2ptAtt}
          </li>
          <li>
            {t("dashboards.table.shots1pt")}: {stats.shots1ptMade}/{stats.shots1ptAtt}
          </li>
          <li>
            {t("dashboards.table.ft")}: {stats.ftMade}/{stats.ftAtt}
          </li>
          <li>
            {t("dashboards.table.rebounds")}: {stats.offRebounds + stats.defRebounds}
          </li>
          <li>
            {t("dashboards.table.assists")}: {stats.assists}
          </li>
          <li>
            {t("dashboards.table.steals")}: {stats.steals}
          </li>
          <li>
            {t("dashboards.table.blocks")}: {stats.blocks}
          </li>
          <li>
            {t("dashboards.table.fouls")}: {stats.personalFouls}
          </li>
          <li>
            {t("dashboards.team.gamesPlayed")}: {stats.gamesPlayed}
          </li>
        </ul>
      )}
    </div>
  );
}

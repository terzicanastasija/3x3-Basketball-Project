import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useCurrentUser } from "../api";
import { useTournaments } from "../../tournaments/api";
import { useMatchesForTournament, Match } from "../../matches/api";
import { useTeam } from "../../teams/api";
import { useTagsForMatch } from "../../tags/api";

// A match's own record only carries `lockedAt` — whether a Scout has actually started tagging
// it (vs. never touched it at all) isn't visible without also checking whether it has any tags,
// hence the extra fetch this component makes per row (fine at this app's data scale — a
// tournament has a handful of matches, same "N+1 is fine here" call made elsewhere, e.g.
// PlayersService's PPG filter).
function RecentMatchRow({ match }: { match: Match }) {
  const { t } = useTranslation();
  const { data: homeTeam } = useTeam(match.homeTeamId);
  const { data: awayTeam } = useTeam(match.awayTeamId);
  const { data: tags } = useTagsForMatch(match.id);

  const status = match.lockedAt ? "locked" : tags && tags.length > 0 ? "inProgress" : "notStarted";
  const badgeClass = status === "locked" ? "badge-locked" : status === "inProgress" ? "badge-gold" : "badge-red";

  return (
    <li>
      <Link
        to={`/matches/${match.id}`}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <span>
          {match.phase && `${t(`matchPhase.${match.phase}`)} — `}
          {homeTeam?.name ?? "…"} {t("matches.detail.vs")} {awayTeam?.name ?? "…"}
        </span>
        <span className={`badge ${badgeClass}`}>{t(`home.matchStatus.${status}`)}</span>
      </Link>
    </li>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUser();
  const { data: tournaments } = useTournaments();

  // "Last tournament" = the one with the most recent start date, not just last-created.
  const latestTournament = useMemo(() => {
    if (!tournaments || tournaments.length === 0) return undefined;
    return [...tournaments].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  }, [tournaments]);

  const { data: matches } = useMatchesForTournament(latestTournament?.id);

  if (isLoading) return <p>{t("home.loading")}</p>;

  return (
    <div className="page">
      <h1>{t("home.welcome", { name: user ? `${user.firstName} ${user.lastName}` : "" })}</h1>

      <div className="card">
        {latestTournament ? (
          <>
            <h2>
              <Link to={`/tournaments/${latestTournament.id}`}>{latestTournament.name}</Link>
            </h2>
            <ul className="list">
              {matches?.map((match) => (
                <RecentMatchRow key={match.id} match={match} />
              ))}
              {matches?.length === 0 && <li className="empty">{t("tournaments.detail.noMatches")}</li>}
            </ul>
          </>
        ) : (
          <p className="empty">{t("home.noTournaments")}</p>
        )}
      </div>
    </div>
  );
}

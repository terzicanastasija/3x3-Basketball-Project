import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ACTION_TYPE_I18N_KEY, ActionType, TagSearchQueryDto } from "@3x3/shared";
import { useSearchTags } from "../api";
import { useTournaments } from "../../tournaments/api";
import { usePlayers } from "../../players/api";
import { ClipBadge } from "../../clips/ClipBadge";

// "Any" is represented as leaving the filter key out of the query object entirely, not as a
// sentinel value — matches every other filtered list page in this app (PlayersListPage etc).
export function TagSearchPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<TagSearchQueryDto>({});
  const { data: results, isLoading } = useSearchTags(filters);
  const { data: tournaments } = useTournaments();
  const { data: players } = usePlayers({});

  const updateFilter = (patch: Partial<TagSearchQueryDto>) => setFilters((prev) => ({ ...prev, ...patch }));

  return (
    <div className="page page-wide">
      <h1>{t("tagSearch.title")}</h1>
      <p className="hint">{t("tagSearch.description")}</p>

      <div className="card inline-row">
        <select value={filters.tournamentId ?? ""} onChange={(e) => updateFilter({ tournamentId: e.target.value || undefined })}>
          <option value="">{t("tagSearch.allTournaments")}</option>
          {tournaments?.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
        <select value={filters.playerId ?? ""} onChange={(e) => updateFilter({ playerId: e.target.value || undefined })}>
          <option value="">{t("tagSearch.anyPlayer")}</option>
          {players?.map((player) => (
            <option key={player.id} value={player.id}>
              {player.firstName} {player.lastName}
              {player.homeClub && ` — ${player.homeClub.name}`}
            </option>
          ))}
        </select>
        <select value={filters.defenderId ?? ""} onChange={(e) => updateFilter({ defenderId: e.target.value || undefined })}>
          <option value="">{t("tagSearch.anyDefender")}</option>
          {players?.map((player) => (
            <option key={player.id} value={player.id}>
              {player.firstName} {player.lastName}
              {player.homeClub && ` — ${player.homeClub.name}`}
            </option>
          ))}
        </select>
        <select
          value={filters.actionType ?? ""}
          onChange={(e) => updateFilter({ actionType: (e.target.value as ActionType) || undefined })}
        >
          <option value="">{t("tagSearch.anyActionType")}</option>
          {Object.values(ActionType).map((actionType) => (
            <option key={actionType} value={actionType}>
              {t(ACTION_TYPE_I18N_KEY[actionType])}
            </option>
          ))}
        </select>
        <select
          value={filters.isMade === undefined ? "" : String(filters.isMade)}
          onChange={(e) => updateFilter({ isMade: e.target.value === "" ? undefined : e.target.value === "true" })}
        >
          <option value="">{t("tagSearch.madeOrMissed.any")}</option>
          <option value="true">{t("tagSearch.madeOrMissed.made")}</option>
          <option value="false">{t("tagSearch.madeOrMissed.missed")}</option>
        </select>
        <select
          value={filters.reviewed === undefined ? "" : String(filters.reviewed)}
          onChange={(e) => updateFilter({ reviewed: e.target.value === "" ? undefined : e.target.value === "true" })}
        >
          <option value="">{t("tagSearch.reviewState.any")}</option>
          <option value="true">{t("tagSearch.reviewState.reviewed")}</option>
          <option value="false">{t("tagSearch.reviewState.unreviewed")}</option>
        </select>
      </div>

      {isLoading && <p>{t("home.loading")}</p>}
      <ul className="list">
        {results?.map((tag) => (
          <li key={tag.id} style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>
              <Link to={`/matches/${tag.match.id}/tag`}>
                {tag.match.tournament.name}
                {tag.match.phase && ` — ${t(`matchPhase.${tag.match.phase}`)}`} — {tag.match.homeTeam.name}{" "}
                {t("matches.detail.vs")} {tag.match.awayTeam.name}
              </Link>
              <br />
              <span className="hint">{tag.timestampSec.toFixed(1)}s</span> — {t(ACTION_TYPE_I18N_KEY[tag.actionType])}
              {tag.pointValue ? ` (+${tag.pointValue})` : ""}
              {tag.player ? ` — ${tag.player.firstName} ${tag.player.lastName}` : ""}
              {tag.relatedPlayer ? ` (${tag.relatedPlayer.firstName} ${tag.relatedPlayer.lastName})` : ""}
              {tag.defender ? ` · ${t("tagging.defendedBy", { name: `${tag.defender.firstName} ${tag.defender.lastName}` })}` : ""}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {tag.reviewedAt && <span className="badge badge-locked">{t("tagging.reviewed")}</span>}
              <ClipBadge tagId={tag.id} />
            </span>
          </li>
        ))}
        {results?.length === 0 && <li className="empty">{t("tagSearch.empty")}</li>}
      </ul>
    </div>
  );
}

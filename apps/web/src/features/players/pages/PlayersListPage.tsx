import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlayerSearchQueryDto } from "@3x3/shared";
import { usePlayers } from "../api";
import { NavBar } from "../../../components/NavBar";

export function PlayersListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<PlayerSearchQueryDto>({});
  const { data: players, isLoading } = usePlayers(filters);

  const updateFilter = (patch: Partial<PlayerSearchQueryDto>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{t("players.title")}</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder={t("players.filters.clubId") ?? ""}
          value={filters.clubId ?? ""}
          onChange={(e) => updateFilter({ clubId: e.target.value || undefined })}
        />
        <input
          placeholder={t("players.filters.city") ?? ""}
          value={filters.city ?? ""}
          onChange={(e) => updateFilter({ city: e.target.value || undefined })}
        />
        <input
          type="number"
          placeholder={t("players.filters.minAge") ?? ""}
          value={filters.minAge ?? ""}
          onChange={(e) =>
            updateFilter({ minAge: e.target.value ? Number(e.target.value) : undefined })
          }
          style={{ width: 90 }}
        />
        <input
          type="number"
          placeholder={t("players.filters.maxAge") ?? ""}
          value={filters.maxAge ?? ""}
          onChange={(e) =>
            updateFilter({ maxAge: e.target.value ? Number(e.target.value) : undefined })
          }
          style={{ width: 90 }}
        />
      </div>

      {isLoading && <p>{t("home.loading")}</p>}
      <ul>
        {players?.map((player) => (
          <li key={player.id}>
            <Link to={`/players/${player.id}`}>
              {player.firstName} {player.lastName}
            </Link>
            {player.homeClub && ` — ${player.homeClub.name}`}
          </li>
        ))}
        {players?.length === 0 && <li>{t("players.empty")}</li>}
      </ul>
    </div>
  );
}

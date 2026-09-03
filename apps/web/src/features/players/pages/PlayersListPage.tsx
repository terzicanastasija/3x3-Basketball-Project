import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlayerSearchQueryDto } from "@3x3/shared";
import { usePlayers } from "../api";
import { useClubs } from "../../clubs/api";

export function PlayersListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<PlayerSearchQueryDto>({});
  const { data: players, isLoading } = usePlayers(filters);
  const { data: clubs } = useClubs();

  const updateFilter = (patch: Partial<PlayerSearchQueryDto>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  return (
    <div className="page">
      <h1>{t("players.title")}</h1>

      <div className="card inline-row">
        <select
          value={filters.clubId ?? ""}
          onChange={(e) => updateFilter({ clubId: e.target.value || undefined })}
          className="inline-field"
        >
          <option value="">{t("players.filters.allClubs")}</option>
          {clubs?.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
        <input
          placeholder={t("players.filters.city") ?? ""}
          value={filters.city ?? ""}
          onChange={(e) => updateFilter({ city: e.target.value || undefined })}
          className="inline-field"
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
        <input
          type="number"
          step="0.1"
          placeholder={t("players.filters.minPpg") ?? ""}
          value={filters.minPpg ?? ""}
          onChange={(e) =>
            updateFilter({ minPpg: e.target.value ? Number(e.target.value) : undefined })
          }
          style={{ width: 90 }}
        />
        <input
          type="number"
          step="0.1"
          placeholder={t("players.filters.maxPpg") ?? ""}
          value={filters.maxPpg ?? ""}
          onChange={(e) =>
            updateFilter({ maxPpg: e.target.value ? Number(e.target.value) : undefined })
          }
          style={{ width: 90 }}
        />
      </div>

      {isLoading && <p>{t("home.loading")}</p>}
      <ul className="list">
        {players?.map((player) => (
          <li key={player.id}>
            <Link to={`/players/${player.id}`}>
              {player.firstName} {player.lastName}
              {player.homeClub && ` — ${player.homeClub.name}`}
            </Link>
          </li>
        ))}
        {players?.length === 0 && <li className="empty">{t("players.empty")}</li>}
      </ul>
    </div>
  );
}

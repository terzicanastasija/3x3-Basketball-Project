import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createTournamentSchema, CreateTournamentDto, TournamentFormat } from "@3x3/shared";
import { useCreateTournament, useTournaments } from "../api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";

export function TournamentsListPage() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const { data: tournaments, isLoading } = useTournaments();
  const createTournament = useCreateTournament();

  // UI-level gating only — the real authority is the server, which requires an Admin
  // (superadmin) for tournament management, per the RBAC overhaul (see PROGRESS.md).
  const canCreate = currentUser?.isSuperadmin;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTournamentDto>({ resolver: zodResolver(createTournamentSchema) });

  const onSubmit = (dto: CreateTournamentDto) => {
    createTournament.mutate(dto, { onSuccess: () => reset() });
  };

  return (
    <div className="page">
      <h1>{t("tournaments.title")}</h1>
      {isLoading && <p>{t("home.loading")}</p>}
      <ul className="list">
        {tournaments?.map((tournament) => (
          <li key={tournament.id}>
            <Link to={`/tournaments/${tournament.id}`}>
              {tournament.name} — {new Date(tournament.startDate).toLocaleDateString()}
            </Link>
          </li>
        ))}
        {tournaments?.length === 0 && <li className="empty">{t("tournaments.empty")}</li>}
      </ul>

      {canCreate && (
        <div className="card section">
          <h2>{t("tournaments.create.title")}</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tournaments.create.name")}
                <input {...register("name")} />
              </label>
              {errors.name && <span className="field-error">{errors.name.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tournaments.create.startDate")}
                <input type="date" {...register("startDate")} />
              </label>
              {errors.startDate && <span className="field-error">{errors.startDate.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tournaments.create.format")}
                <select {...register("format")}>
                  {Object.values(TournamentFormat).map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {createTournament.isError && (
              <p className="field-error">
                {createTournament.error instanceof ApiError
                  ? createTournament.error.message
                  : t("tournaments.create.error")}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={createTournament.isPending}>
              {t("tournaments.create.submit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

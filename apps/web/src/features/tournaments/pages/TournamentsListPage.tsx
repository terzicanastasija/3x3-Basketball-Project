import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createTournamentSchema, CreateTournamentDto, Role, TournamentFormat } from "@3x3/shared";
import { useCreateTournament, useTournaments } from "../api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";
import { NavBar } from "../../../components/NavBar";

export function TournamentsListPage() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const { data: tournaments, isLoading } = useTournaments();
  const createTournament = useCreateTournament();

  const canCreate =
    currentUser?.isSuperadmin || currentUser?.memberships.some((m) => m.role === Role.CLUB_ADMIN);

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
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{t("tournaments.title")}</h1>
      {isLoading && <p>{t("home.loading")}</p>}
      <ul>
        {tournaments?.map((tournament) => (
          <li key={tournament.id}>
            <Link to={`/tournaments/${tournament.id}`}>
              {tournament.name} — {new Date(tournament.startDate).toLocaleDateString()}
            </Link>
          </li>
        ))}
        {tournaments?.length === 0 && <li>{t("tournaments.empty")}</li>}
      </ul>

      {canCreate && (
        <div style={{ marginTop: 24 }}>
          <h2>{t("tournaments.create.title")}</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tournaments.create.name")}
                <input {...register("name")} style={{ display: "block", width: "100%" }} />
              </label>
              {errors.name && <span style={{ color: "red" }}>{errors.name.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tournaments.create.startDate")}
                <input
                  type="date"
                  {...register("startDate")}
                  style={{ display: "block", width: "100%" }}
                />
              </label>
              {errors.startDate && <span style={{ color: "red" }}>{errors.startDate.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tournaments.create.format")}
                <select {...register("format")} style={{ display: "block", width: "100%" }}>
                  {Object.values(TournamentFormat).map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {createTournament.isError && (
              <p style={{ color: "red" }}>
                {createTournament.error instanceof ApiError
                  ? createTournament.error.message
                  : t("tournaments.create.error")}
              </p>
            )}
            <button type="submit" disabled={createTournament.isPending}>
              {t("tournaments.create.submit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createClubSchema, CreateClubDto } from "@3x3/shared";
import { useClubs, useCreateClub } from "../api";
import { useCurrentUser } from "../../auth/api";
import { ApiError } from "../../../lib/api-client";
import { NavBar } from "../../../components/NavBar";

export function ClubsListPage() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const { data: clubs, isLoading } = useClubs();
  const createClub = useCreateClub();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClubDto>({ resolver: zodResolver(createClubSchema) });

  const onSubmit = (dto: CreateClubDto) => {
    createClub.mutate(dto, { onSuccess: () => reset() });
  };

  return (
    <div className="page">
      <NavBar />
      <h1>{t("clubs.title")}</h1>
      {isLoading && <p>{t("home.loading")}</p>}
      <ul className="list">
        {clubs?.map((club) => (
          <li key={club.id}>
            <Link to={`/clubs/${club.id}`}>
              {club.name}
              {club.city ? ` (${club.city})` : ""}
            </Link>
          </li>
        ))}
        {clubs?.length === 0 && <li className="empty">{t("clubs.empty")}</li>}
      </ul>

      {currentUser?.isSuperadmin && (
        <div className="card section">
          <h2>{t("clubs.create.title")}</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("clubs.create.name")}
                <input {...register("name")} />
              </label>
              {errors.name && <span className="field-error">{errors.name.message}</span>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("clubs.create.city")}
                <input {...register("city")} />
              </label>
            </div>
            {createClub.isError && (
              <p className="field-error">
                {createClub.error instanceof ApiError ? createClub.error.message : t("clubs.create.error")}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={createClub.isPending}>
              {t("clubs.create.submit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

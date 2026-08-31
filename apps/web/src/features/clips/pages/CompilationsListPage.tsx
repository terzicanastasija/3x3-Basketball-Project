import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCompilations } from "../api";
import { NavBar } from "../../../components/NavBar";

export function CompilationsListPage() {
  const { t } = useTranslation();
  const { data: compilations, isLoading } = useCompilations();

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{t("clips.list.title")}</h1>
      {isLoading && <p>{t("home.loading")}</p>}
      <ul>
        {compilations?.map((compilation) => (
          <li key={compilation.id}>
            <Link to={`/compilations/${compilation.id}`}>{compilation.title}</Link>
          </li>
        ))}
        {compilations?.length === 0 && <li>{t("clips.list.empty")}</li>}
      </ul>
    </div>
  );
}

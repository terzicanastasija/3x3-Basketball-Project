import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCompilations } from "../api";

export function CompilationsListPage() {
  const { t } = useTranslation();
  const { data: compilations, isLoading } = useCompilations();

  return (
    <div className="page">
      <h1>{t("clips.list.title")}</h1>
      <p className="hint">{t("clips.list.description")}</p>
      {isLoading && <p>{t("home.loading")}</p>}
      <ul className="list">
        {compilations?.map((compilation) => (
          <li key={compilation.id}>
            <Link to={`/compilations/${compilation.id}`}>{compilation.title}</Link>
          </li>
        ))}
        {compilations?.length === 0 && <li className="empty">{t("clips.list.empty")}</li>}
      </ul>
    </div>
  );
}

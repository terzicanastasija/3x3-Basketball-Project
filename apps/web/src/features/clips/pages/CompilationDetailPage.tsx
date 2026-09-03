import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ACTION_TYPE_I18N_KEY } from "@3x3/shared";
import { useCompilation } from "../api";

export function CompilationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: compilation, isLoading } = useCompilation(id);

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!compilation) return <p>{t("clips.detail.notFound")}</p>;

  return (
    <div className="page">
      <h1>{compilation.title}</h1>
      <ol className="card" style={{ paddingLeft: 20 }}>
        {compilation.items.map((item) => (
          <li key={item.id} style={{ marginBottom: 14 }}>
            {t(ACTION_TYPE_I18N_KEY[item.actionTag.actionType as keyof typeof ACTION_TYPE_I18N_KEY])} —{" "}
            {item.actionTag.timestampSec.toFixed(1)}s{" "}
            <Link to={`/matches/${item.actionTag.matchId}/dashboard`}>{t("clips.detail.match")}</Link>{" "}
            {item.clip.type === "DEEP_LINK" && (
              <a href={item.clip.url} target="_blank" rel="noreferrer">
                {t("clips.deepLink")}
              </a>
            )}
            {item.clip.type === "CLIP" && item.clip.status === "COMPLETED" && item.clip.url && (
              <video
                src={item.clip.url}
                controls
                style={{ display: "block", maxWidth: 320, marginTop: 8, borderRadius: 6 }}
              />
            )}
            {item.clip.type === "CLIP" && item.clip.status !== "COMPLETED" && (
              <span className={item.clip.status === "FAILED" ? "badge badge-red" : "badge"}>
                {item.clip.status === "FAILED" ? t("clips.failed") : t("clips.processing")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

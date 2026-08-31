import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ACTION_TYPE_I18N_KEY } from "@3x3/shared";
import { useCompilation } from "../api";
import { NavBar } from "../../../components/NavBar";

export function CompilationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: compilation, isLoading } = useCompilation(id);

  if (isLoading) return <p>{t("home.loading")}</p>;
  if (!compilation) return <p>{t("clips.detail.notFound")}</p>;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>{compilation.title}</h1>
      <ol>
        {compilation.items.map((item) => (
          <li key={item.id} style={{ marginBottom: 8 }}>
            {t(ACTION_TYPE_I18N_KEY[item.actionTag.actionType as keyof typeof ACTION_TYPE_I18N_KEY])} —{" "}
            {item.actionTag.timestampSec.toFixed(1)}s{" "}
            <Link to={`/matches/${item.actionTag.matchId}/dashboard`}>{t("clips.detail.match")}</Link>{" "}
            {item.clip.type === "DEEP_LINK" && (
              <a href={item.clip.url} target="_blank" rel="noreferrer">
                {t("clips.deepLink")}
              </a>
            )}
            {item.clip.type === "CLIP" && item.clip.status === "COMPLETED" && item.clip.url && (
              <video src={item.clip.url} controls style={{ display: "block", maxWidth: 320, marginTop: 4 }} />
            )}
            {item.clip.type === "CLIP" && item.clip.status !== "COMPLETED" && (
              <span style={{ color: item.clip.status === "FAILED" ? "red" : "#888" }}>
                {item.clip.status === "FAILED" ? t("clips.failed") : t("clips.processing")}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

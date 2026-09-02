import { useTranslation } from "react-i18next";
import { useTagClip } from "./api";

// Shows a tag's clip state inline in a tag list: a YouTube deep link is available immediately
// (no job), a FILE clip goes QUEUED -> PROCESSING -> COMPLETED (polled) or FAILED.
export function ClipBadge({ tagId }: { tagId: string }) {
  const { t } = useTranslation();
  const { data: clip } = useTagClip(tagId);

  if (!clip || clip.type === "NONE") return null;

  if (clip.type === "DEEP_LINK") {
    return (
      <a href={clip.url} target="_blank" rel="noreferrer">
        {t("clips.deepLink")}
      </a>
    );
  }

  if (clip.status === "COMPLETED" && clip.url) {
    return (
      <a href={clip.url} target="_blank" rel="noreferrer">
        {t("clips.playClip")}
      </a>
    );
  }

  if (clip.status === "FAILED") {
    return (
      <span className="badge badge-red" title={clip.errorMessage ?? undefined}>
        {t("clips.failed")}
      </span>
    );
  }

  return <span className="badge">{t("clips.processing")}</span>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ACTION_TYPE_HOTKEYS,
  ACTION_TYPE_I18N_KEY,
  ACTION_TYPES_WITH_RELATED_PLAYER,
  ActionType,
} from "@3x3/shared";
import { useMatch } from "../../matches/api";
import { useTeam } from "../../teams/api";
import { useRoster } from "../../rosters/api";
import { usePlayers } from "../../players/api";
import { usePlaybackUrl, useVideosForMatch } from "../../video/api";
import { VideoRegistrationPanel } from "../../video/VideoRegistrationPanel";
import { useCreateTag, useDeleteTag, useLockMatch, useTagsForMatch, useUpdateTag } from "../../tags/api";
import { ClipBadge } from "../../clips/ClipBadge";
import { useCreateCompilation } from "../../clips/api";
import { VideoPlayer } from "../player/VideoPlayer";
import { VideoPlayerAdapter } from "../player/VideoPlayerAdapter";
import { NavBar } from "../../../components/NavBar";

const HOTKEY_TO_ACTION_TYPE: Record<string, ActionType> = Object.fromEntries(
  Object.entries(ACTION_TYPE_HOTKEYS).map(([actionType, key]) => [key, actionType as ActionType])
);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
}

export function TaggingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { matchId } = useParams<{ matchId: string }>();
  const { data: match, isLoading: matchLoading } = useMatch(matchId);
  const { data: homeTeam } = useTeam(match?.homeTeamId);
  const { data: awayTeam } = useTeam(match?.awayTeamId);

  const { data: videos } = useVideosForMatch(matchId);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  useEffect(() => {
    // Nothing chosen yet on this visit but a video is already registered — jump straight to
    // tagging instead of making the coach re-pick from a radio list every time they arrive.
    if (!selectedVideoId && videos && videos.length > 0) {
      setSelectedVideoId(videos[0].id);
    }
  }, [videos, selectedVideoId]);
  const { data: playback } = usePlaybackUrl(selectedVideoId ?? undefined);
  const adapterRef = useRef<VideoPlayerAdapter | null>(null);
  const [adapterReady, setAdapterReady] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedRelatedPlayerId, setSelectedRelatedPlayerId] = useState<string>("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [recaptureTimestamp, setRecaptureTimestamp] = useState(false);

  useEffect(() => {
    if (match && !selectedTeamId) setSelectedTeamId(match.homeTeamId);
  }, [match, selectedTeamId]);

  const homeRoster = useRoster(match?.homeTeamId, match?.tournamentId);
  const awayRoster = useRoster(match?.awayTeamId, match?.tournamentId);
  const isHomeSelected = selectedTeamId === match?.homeTeamId;
  const activeRosterQuery = isHomeSelected ? homeRoster : awayRoster;
  // Prefer the tournament roster for the selected team; if none has been built yet (and we're
  // sure, not just still loading), fall back to the team's whole club roster so tagging is
  // never blocked on roster-building first. Only fetches the fallback when actually needed.
  const fallbackClubId = isHomeSelected ? homeTeam?.clubId : awayTeam?.clubId;
  const needsFallback = !activeRosterQuery.isLoading && !activeRosterQuery.data;
  const fallbackPlayers = usePlayers(
    fallbackClubId ? { clubId: fallbackClubId } : {},
    { enabled: needsFallback && Boolean(fallbackClubId) }
  );
  const teamPlayers = useMemo(() => {
    if (activeRosterQuery.data) return activeRosterQuery.data.players.map((p) => p.player);
    return fallbackPlayers.data ?? [];
  }, [activeRosterQuery.data, fallbackPlayers.data]);

  const { data: tags } = useTagsForMatch(matchId);
  const createTag = useCreateTag(matchId ?? "");
  const updateTag = useUpdateTag(matchId ?? "");
  const deleteTag = useDeleteTag(matchId ?? "");
  const lockMatch = useLockMatch(matchId ?? "");

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [compilationTitle, setCompilationTitle] = useState("");
  const createCompilation = useCreateCompilation();

  function toggleTagSelection(tagId: string) {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }

  function handleCreateCompilation() {
    if (!compilationTitle.trim() || selectedTagIds.length === 0) return;
    createCompilation.mutate(
      { title: compilationTitle.trim(), actionTagIds: selectedTagIds },
      { onSuccess: (compilation) => navigate(`/compilations/${compilation.id}`) }
    );
  }

  const isLocked = Boolean(match?.lockedAt);

  function handleActionType(actionType: ActionType) {
    if (isLocked || !selectedTeamId) return;
    const timestampSec = adapterRef.current?.getCurrentTime() ?? 0;
    const isMade = actionType.endsWith("_MADE") ? true : actionType.endsWith("_MISSED") ? false : undefined;
    const relatedAllowed = ACTION_TYPES_WITH_RELATED_PLAYER.includes(actionType);

    if (editingTagId) {
      updateTag.mutate({
        tagId: editingTagId,
        dto: {
          actionType,
          playerId: selectedPlayerId || null,
          relatedPlayerId: relatedAllowed ? selectedRelatedPlayerId || null : null,
          isMade,
          ...(recaptureTimestamp ? { timestampSec } : {}),
        },
      });
      setEditingTagId(null);
      setRecaptureTimestamp(false);
      return;
    }

    createTag.mutate({
      videoAssetId: selectedVideoId ?? undefined,
      timestampSec,
      actionType,
      teamId: selectedTeamId,
      playerId: selectedPlayerId || undefined,
      relatedPlayerId: relatedAllowed ? selectedRelatedPlayerId || undefined : undefined,
      isMade,
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || isLocked) return;
      const actionType = HOTKEY_TO_ACTION_TYPE[e.key];
      if (actionType) {
        e.preventDefault();
        handleActionType(actionType);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, editingTagId, selectedTeamId, selectedPlayerId, selectedRelatedPlayerId, selectedVideoId, recaptureTimestamp]);

  function startEditing(tagId: string) {
    const tag = tags?.find((t) => t.id === tagId);
    if (!tag) return;
    setEditingTagId(tagId);
    setSelectedTeamId(tag.teamId);
    setSelectedPlayerId(tag.playerId ?? "");
    setSelectedRelatedPlayerId(tag.relatedPlayerId ?? "");
    setRecaptureTimestamp(false);
  }

  if (matchLoading) return <p>{t("home.loading")}</p>;
  if (!match) return <p>{t("matches.notFound")}</p>;

  return (
    <div style={{ maxWidth: 960, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <NavBar />
      <h1>
        {t("tagging.title")}: {homeTeam?.name ?? "…"} {t("matches.detail.vs")} {awayTeam?.name ?? "…"}
      </h1>

      {isLocked && <p style={{ color: "green", fontWeight: "bold" }}>{t("tagging.locked")}</p>}

      {!selectedVideoId && matchId && (
        <VideoRegistrationPanel matchId={matchId} selectedVideoId={selectedVideoId} onSelect={setSelectedVideoId} />
      )}

      {selectedVideoId && playback && (
        <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
          <div>
            <VideoPlayer
              sourceType={playback.sourceType as "FILE" | "EXTERNAL"}
              src={playback.url}
              onAdapterReady={(adapter) => {
                adapterRef.current = adapter;
                setAdapterReady(true);
              }}
            />
            <button onClick={() => setSelectedVideoId(null)} style={{ marginTop: 8 }}>
              {t("tagging.video.changeVideo")}
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 12 }}>
              <label>
                {t("tagging.team")}
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value);
                    setSelectedPlayerId("");
                    setSelectedRelatedPlayerId("");
                  }}
                  style={{ display: "block" }}
                >
                  {homeTeam && <option value={homeTeam.id}>{homeTeam.name}</option>}
                  {awayTeam && <option value={awayTeam.id}>{awayTeam.name}</option>}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <label>
                {t("tagging.player")}
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  style={{ display: "block" }}
                >
                  <option value="">{t("tagging.selectPlayer")}</option>
                  {teamPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("tagging.relatedPlayer")}
                <select
                  value={selectedRelatedPlayerId}
                  onChange={(e) => setSelectedRelatedPlayerId(e.target.value)}
                  style={{ display: "block" }}
                >
                  <option value="">{t("tagging.selectPlayer")}</option>
                  {teamPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {editingTagId && (
              <p style={{ background: "#eef", padding: 8 }}>
                {t("tagging.editingHint")}
                <label style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={recaptureTimestamp}
                    onChange={(e) => setRecaptureTimestamp(e.target.checked)}
                  />
                  {t("tagging.recaptureTimestamp")}
                </label>
                <button onClick={() => setEditingTagId(null)}>{t("tagging.cancelEdit")}</button>
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {Object.values(ActionType).map((actionType) => (
                <button
                  key={actionType}
                  disabled={isLocked || !adapterReady}
                  onClick={() => handleActionType(actionType)}
                  title={`${t("tagging.hotkeyHint")}: ${ACTION_TYPE_HOTKEYS[actionType]}`}
                >
                  {t(ACTION_TYPE_I18N_KEY[actionType])} ({ACTION_TYPE_HOTKEYS[actionType]})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h2>{t("tagging.tagList")}</h2>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          <ul>
            {tags?.map((tag) => (
              <li key={tag.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => toggleTagSelection(tag.id)}
                  />{" "}
                  {tag.timestampSec.toFixed(1)}s — {t(ACTION_TYPE_I18N_KEY[tag.actionType])}
                  {tag.pointValue ? ` (+${tag.pointValue})` : ""}
                </label>
                <ClipBadge tagId={tag.id} />{" "}
                {!isLocked && (
                  <>
                    <button onClick={() => startEditing(tag.id)}>{t("tagging.edit")}</button>{" "}
                    <button onClick={() => deleteTag.mutate(tag.id)}>{t("tagging.delete")}</button>
                  </>
                )}
              </li>
            ))}
            {tags?.length === 0 && <li>{t("tagging.noTags")}</li>}
          </ul>
        </div>

        {selectedTagIds.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: "#eef" }}>
            <label>
              {t("clips.compilationTitle")}
              <input
                value={compilationTitle}
                onChange={(e) => setCompilationTitle(e.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>{" "}
            <button onClick={handleCreateCompilation} disabled={createCompilation.isPending}>
              {t("clips.buildCompilation", { count: selectedTagIds.length })}
            </button>
          </div>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "white", padding: 12, borderTop: "1px solid #ccc" }}>
        <button onClick={() => lockMatch.mutate()} disabled={isLocked || lockMatch.isPending}>
          {isLocked ? t("tagging.locked") : t("tagging.lockMatch")}
        </button>
      </div>
    </div>
  );
}

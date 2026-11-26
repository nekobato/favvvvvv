import { maxBookmarkTitleLength } from "../shared/bookmarks";
import type { LinkPreview } from "../workers/metadata/preview";
import { fetchLinkPreview, type LinkPreviewEnv } from "./link-preview";

export async function fetchBookmarkPreview(env: LinkPreviewEnv, url: string) {
  const preview = await fetchLinkPreview(env, url, true, true).catch(() => null);
  if (!preview) return null;
  const title = typeof preview.title === "string" ? preview.title.trim().slice(0, maxBookmarkTitleLength) || null : null;
  return { ...preview, title };
}

export async function saveBookmarkPreviews(
  db: D1Database,
  userId: string,
  bookmarks: { id: string; url: string; preview: LinkPreview | null }[],
) {
  const writes = bookmarks.flatMap(({ id, url, preview }) => {
    const { favicon, thumbnail } = preview ?? {};
    if (!favicon && !thumbnail) return [];

    return [db.prepare(`
      INSERT INTO bookmark_previews (bookmark_id, url, revision, favicon_type, favicon, thumbnail_type, thumbnail)
      SELECT id, url, ?, ?, ?, ?, ? FROM bookmarks WHERE id = ? AND user_id = ? AND url = ?
      ON CONFLICT(bookmark_id) DO UPDATE SET
        url = excluded.url,
        revision = excluded.revision,
        favicon_type = CASE WHEN bookmark_previews.url = excluded.url
          THEN coalesce(excluded.favicon_type, bookmark_previews.favicon_type) ELSE excluded.favicon_type END,
        favicon = CASE WHEN bookmark_previews.url = excluded.url
          THEN coalesce(excluded.favicon, bookmark_previews.favicon) ELSE excluded.favicon END,
        thumbnail_type = CASE WHEN bookmark_previews.url = excluded.url
          THEN coalesce(excluded.thumbnail_type, bookmark_previews.thumbnail_type) ELSE excluded.thumbnail_type END,
        thumbnail = CASE WHEN bookmark_previews.url = excluded.url
          THEN coalesce(excluded.thumbnail, bookmark_previews.thumbnail) ELSE excluded.thumbnail END
    `).bind(
      crypto.randomUUID(), favicon?.type ?? null, favicon?.bytes ?? null,
      thumbnail?.type ?? null, thumbnail?.bytes ?? null, id, userId, url,
    )];
  });
  if (!writes.length) return false;

  // Link registration is already committed, so a failed preview write leaves a usable link.
  const results = await db.batch(writes).catch(() => null);
  return results?.some(({ meta }) => meta.changes > 0) ?? false;
}

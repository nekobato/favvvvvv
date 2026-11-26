import { bookmarkTitle } from "./bookmark-input";
import { fetchBookmarkPreview, saveBookmarkPreviews } from "./bookmark-preview";
import { fetchLinkPreview, type LinkPreviewEnv } from "./link-preview";
import type { CollectionSummary, SavedLink } from "../shared/collections";

const pageSize = 30;

export async function listCollections(db: D1Database, userId: string) {
  const { results } = await db.prepare(`
    SELECT c.id, c.name, count(e.id) AS total
    FROM collections c
    LEFT JOIN collection_entries e ON e.user_id = c.user_id AND e.collection_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE, c.id
  `).bind(userId).all<CollectionSummary>();
  return results;
}

export async function readSavedLinkPage(
  database: D1Database,
  userId: string,
  requestedPage: string | undefined,
  collectionId?: string,
) {
  const db = database.withSession("first-primary");
  const from = collectionId
    ? `FROM saved_links l JOIN collection_entries e
      ON e.user_id = l.user_id AND e.link_id = l.id AND e.collection_id = ? WHERE l.user_id = ?`
    : "FROM saved_links l WHERE l.user_id = ?";
  const filter = collectionId ? [collectionId, userId] : [userId];
  const total = await db.prepare(`SELECT count(*) AS total ${from}`).bind(...filter).first<number>("total") ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number(requestedPage);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(pageCount, requested)) : 1;
  const order = collectionId ? "e.added_at DESC, e.id DESC" : "l.created_at DESC, l.id DESC";
  const { results } = await db.prepare(`
    SELECT l.id, l.title, l.url, l.thumbnail_type IS NOT NULL AS hasThumbnail,
      EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = l.user_id AND b.url = l.url) AS inDashboard,
      (SELECT json_group_array(e.collection_id) FROM collection_entries e
        WHERE e.user_id = l.user_id AND e.link_id = l.id) AS collectionIds
    ${from}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).bind(...filter, pageSize, (page - 1) * pageSize)
    .all<Omit<SavedLink, "hasThumbnail" | "inDashboard" | "collectionIds"> & {
      hasThumbnail: number;
      inDashboard: number;
      collectionIds: string;
    }>();

  const links: SavedLink[] = results.map((row) => ({
    ...row,
    hasThumbnail: !!row.hasThumbnail,
    inDashboard: !!row.inDashboard,
    collectionIds: JSON.parse(row.collectionIds) as string[],
  }));
  return { links, page, pageCount };
}

export async function captureLink(env: LinkPreviewEnv & { DB: D1Database }, userId: string, url: string) {
  const { DB: db } = env;
  const id = crypto.randomUUID();
  const fallbackTitle = bookmarkTitle("", url);
  const [inserted] = await db.batch([
    db.prepare(`
      INSERT INTO saved_links (id, user_id, title, url, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, url) DO NOTHING
      RETURNING id
    `).bind(id, userId, fallbackTitle, url, Date.now()),
    db.prepare(`
      INSERT INTO audit_events (event, user_id, link_id)
      SELECT 'link.captured', user_id, id FROM saved_links WHERE id = ? AND user_id = ?
    `).bind(id, userId),
  ]);
  if (!inserted.results.length) return;

  try {
    const preview = await fetchLinkPreview(env, url);
    if (!preview) return;
    await db.prepare(`
      UPDATE saved_links SET title = ?, thumbnail_type = ?, thumbnail = ? WHERE id = ? AND user_id = ?
    `).bind(
      preview.title || fallbackTitle,
      preview.thumbnail?.type ?? null,
      preview.thumbnail?.bytes ?? null,
      id,
      userId,
    ).run();
  } catch {
    // The capture is already committed. Its URL and fallback title remain available.
  }
}

export async function addCollectionEntry(db: D1Database, userId: string, collectionId: string, linkId: string) {
  const id = crypto.randomUUID();
  const [, , owned] = await db.batch([
    db.prepare(`
      INSERT INTO collection_entries (id, user_id, collection_id, link_id, added_at)
      SELECT ?, c.user_id, c.id, l.id, ?
      FROM collections c JOIN saved_links l ON l.user_id = c.user_id
      WHERE c.user_id = ? AND c.id = ? AND l.id = ?
      ON CONFLICT(collection_id, link_id) DO NOTHING
    `).bind(id, Date.now(), userId, collectionId, linkId),
    db.prepare(`
      INSERT INTO audit_events (event, user_id, collection_id, link_id)
      SELECT 'collection.link_added', user_id, collection_id, link_id FROM collection_entries WHERE id = ?
    `).bind(id),
    db.prepare(`
      SELECT id FROM collection_entries WHERE user_id = ? AND collection_id = ? AND link_id = ?
    `).bind(userId, collectionId, linkId),
  ]);
  return owned.results.length > 0;
}

export async function removeCollectionEntry(db: D1Database, userId: string, collectionId: string, linkId: string) {
  const [, removed] = await db.batch([
    db.prepare(`
      INSERT INTO audit_events (event, user_id, collection_id, link_id)
      SELECT 'collection.link_removed', user_id, collection_id, link_id FROM collection_entries
      WHERE user_id = ? AND collection_id = ? AND link_id = ?
    `).bind(userId, collectionId, linkId),
    db.prepare(`
      DELETE FROM collection_entries WHERE user_id = ? AND collection_id = ? AND link_id = ? RETURNING id
    `).bind(userId, collectionId, linkId),
  ]);
  return removed.results.length > 0;
}

export async function addEntryToDashboard(env: LinkPreviewEnv & { DB: D1Database }, userId: string, collectionId: string, linkId: string) {
  const db = env.DB;
  const bookmarkId = crypto.randomUUID();
  const [inserted, , owned] = await db.batch<{ url: string }>([
    db.prepare(`
      INSERT INTO bookmarks (id, user_id, title, url, created_at)
      SELECT ?, l.user_id, l.title, l.url, ?
      FROM saved_links l JOIN collection_entries e ON e.link_id = l.id AND e.user_id = l.user_id
      WHERE l.user_id = ? AND l.id = ? AND e.collection_id = ?
        AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = l.user_id AND b.url = l.url)
      RETURNING url
    `).bind(bookmarkId, Date.now(), userId, linkId, collectionId),
    db.prepare(`
      INSERT INTO audit_events (event, user_id, bookmark_id, collection_id, link_id)
      SELECT 'bookmark.created', user_id, id, ?, ? FROM bookmarks WHERE id = ?
    `).bind(collectionId, linkId, bookmarkId),
    db.prepare(`
      SELECT id FROM collection_entries WHERE user_id = ? AND collection_id = ? AND link_id = ?
    `).bind(userId, collectionId, linkId),
  ]);
  const [bookmark] = inserted.results;
  if (bookmark) {
    const preview = await fetchBookmarkPreview(env, bookmark.url);
    await saveBookmarkPreviews(db, userId, [{ id: bookmarkId, url: bookmark.url, preview }]);
  }
  return owned.results.length > 0;
}

import { defineHandler } from "void";
import { z } from "zod";
import { getAllowedUser } from "../../../server/access";
import { bookmarkTitle, bookmarkUrl } from "../../../server/bookmark-input";
import { fetchBookmarkPreview, saveBookmarkPreviews } from "../../../server/bookmark-preview";
import {
  bookmarkImportBatchSize,
  bookmarkImportPreviewLookupLimit,
  maxBookmarkTitleLength,
  maxBookmarkUrlLength,
  type BookmarkImportItem,
  type BookmarkImportResult,
} from "../../../shared/bookmarks";

const importBody = z.object({
  expectedUserId: z.string().min(1).max(128),
  items: z.array(z.object({
    title: z.string().max(maxBookmarkTitleLength),
    url: z.string().max(maxBookmarkUrlLength),
  })).min(1).max(bookmarkImportBatchSize),
});

export const POST = defineHandler.withValidator({ body: importBody })(async (c, { body }) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);
  if (user.id !== body.expectedUserId) return c.text("ログイン中のアカウントが切り替わりました。", 409);

  const candidates = new Map<string, BookmarkImportItem & { id: string }>();
  let skipped = 0;
  for (const item of body.items) {
    const url = bookmarkUrl.safeParse(item.url);
    if (!url.success) {
      skipped += 1;
      continue;
    }
    if (!candidates.has(url.data)) {
      candidates.set(url.data, {
        id: crypto.randomUUID(),
        title: item.title.trim(),
        url: url.data,
      });
    }
  }

  if (!candidates.size) {
    return c.json<BookmarkImportResult>({ imported: 0, duplicates: 0, skipped });
  }

  const rows = [...candidates.values()];
  const db = c.env.DB;
  const { results } = await db.prepare(`
    SELECT DISTINCT url FROM bookmarks
    WHERE user_id = ? AND url IN (SELECT value FROM json_each(?))
  `).bind(user.id, JSON.stringify(rows.map(({ url }) => url))).all<{ url: string }>();
  const existingUrls = new Set(results.map(({ url }) => url));
  // Each preview can fetch a page and two images, including redirects.
  const lookups = rows.filter(({ url }) => !existingUrls.has(url)).slice(0, bookmarkImportPreviewLookupLimit);
  const previews = await Promise.all(lookups.map(async (row) => {
    const preview = await fetchBookmarkPreview(c.env, row.url);
    row.title ||= preview?.title ?? "";
    return { id: row.id, url: row.url, preview };
  }));
  for (const row of rows) row.title = bookmarkTitle(row.title, row.url);

  const [inserted] = await db.batch<{ id: string }>([
    db.prepare(`
      WITH incoming AS (
        SELECT json_extract(value, '$.id') AS id,
               json_extract(value, '$.title') AS title,
               json_extract(value, '$.url') AS url
        FROM json_each(?)
      )
      INSERT INTO bookmarks (id, user_id, title, url, created_at)
      SELECT incoming.id, ?, incoming.title, incoming.url, ?
      FROM incoming
      WHERE NOT EXISTS (
        SELECT 1 FROM bookmarks
        WHERE bookmarks.user_id = ? AND bookmarks.url = incoming.url
      )
      RETURNING id
    `).bind(JSON.stringify(rows), user.id, Date.now(), user.id),
    db.prepare(`
      INSERT INTO audit_events (event, user_id, bookmark_id)
      SELECT 'bookmark.created', user_id, id
      FROM bookmarks
      WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))
    `).bind(user.id, JSON.stringify(rows.map(({ id }) => id))),
  ]);

  const insertedIds = new Set(inserted.results.map(({ id }) => id));
  await saveBookmarkPreviews(db, user.id, previews.filter(({ id }) => insertedIds.has(id)));
  const imported = inserted.results.length;
  return c.json<BookmarkImportResult>({ imported, duplicates: body.items.length - imported - skipped, skipped });
});

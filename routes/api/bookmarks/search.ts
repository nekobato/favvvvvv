import { bookmarks } from "@schema";
import { defineHandler } from "void";
import { createDb, desc } from "void/db";
import { getAllowedUser } from "../../../server/access";
import { bookmarkSearchFilter } from "../../../server/bookmark-search";
import { normalizeBookmarkQuery, type BookmarkSearchResult } from "../../../shared/bookmarks";

const resultLimit = 7;

export const GET = defineHandler(async (c) => {
  c.header("Cache-Control", "private, no-store");

  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);
  const expectedUserId = c.req.header("X-Favvvvvv-User") ?? c.req.header("X-FavPage-User");
  if (expectedUserId !== user.id) {
    return c.text("ログイン中のアカウントが切り替わりました。", 409);
  }

  const query = normalizeBookmarkQuery(c.req.query("q"));
  if (!query) return c.json<BookmarkSearchResult>({ items: [], hasMore: false });

  const db = createDb(c.env.DB, { session: "first-primary" });
  const items = await db.select({
    id: bookmarks.id,
    title: bookmarks.title,
    url: bookmarks.url,
  }).from(bookmarks)
    .where(bookmarkSearchFilter(user.id, query))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .limit(resultLimit + 1);

  return c.json<BookmarkSearchResult>({
    items: items.slice(0, resultLimit),
    hasMore: items.length > resultLimit,
  });
});

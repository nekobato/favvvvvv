import { defineHandler } from "void";
import { z } from "zod";
import { getAllowedUser } from "../../../server/access";
import { bookmarkUrl, fetchBookmarkTitle } from "../../../server/bookmark-input";
import { fetchBookmarkPreview, saveBookmarkPreviews } from "../../../server/bookmark-preview";

const titleBody = z.object({
  id: z.uuid(),
  expectedUserId: z.string().min(1).max(128),
  url: bookmarkUrl,
});

export const POST = defineHandler.withValidator({ body: titleBody })(async (c, { body }) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);
  if (user.id !== body.expectedUserId) return c.text("ログイン中のアカウントが切り替わりました。", 409);

  const bookmark = await c.env.DB.prepare("SELECT url FROM bookmarks WHERE id = ? AND user_id = ?")
    .bind(body.id, user.id).first<{ url: string }>();
  if (!bookmark) return c.text("対象のブックマークが見つかりません。", 404);

  if (bookmark.url !== body.url) {
    return c.json({ title: await fetchBookmarkTitle(c.env, body.url), imagesUpdated: false });
  }

  const preview = await fetchBookmarkPreview(c.env, body.url);
  const imagesUpdated = await saveBookmarkPreviews(c.env.DB, user.id, [{ id: body.id, url: body.url, preview }]);
  return c.json({ title: preview?.title ?? null, imagesUpdated });
});

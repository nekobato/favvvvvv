import { defineHandler } from "void";
import { getAllowedUser } from "../../../../server/access";

export const GET = defineHandler(async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);

  const kind = c.req.query("kind");
  if (kind !== "favicon" && kind !== "thumbnail") return c.notFound();
  const image = await c.env.DB.prepare(`
    SELECT CASE WHEN ?1 = 'favicon' THEN p.favicon_type ELSE p.thumbnail_type END AS type,
           CASE WHEN ?1 = 'favicon' THEN p.favicon ELSE p.thumbnail END AS bytes
    FROM bookmarks b JOIN bookmark_previews p ON p.bookmark_id = b.id AND p.url = b.url
    WHERE b.id = ?2 AND b.user_id = ?3
  `).bind(kind, c.req.param().id, user.id).first<{ type: string | null; bytes: number[] | null }>();
  if (!image?.type || !image.bytes) return c.notFound();
  return c.body(Uint8Array.from(image.bytes), 200, {
    "Content-Type": image.type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
});

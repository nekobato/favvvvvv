import { defineHandler } from "void";
import { getAllowedUser } from "../../../../server/access";

export const GET = defineHandler(async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);

  const image = await c.env.DB.prepare(`
    SELECT thumbnail_type AS type, thumbnail AS bytes FROM saved_links WHERE id = ? AND user_id = ?
  `).bind(c.req.param().id, user.id).first<{ type: string | null; bytes: number[] | null }>();
  if (!image?.type || !image.bytes) return c.notFound();
  return c.body(Uint8Array.from(image.bytes), 200, {
    "Content-Type": image.type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
});

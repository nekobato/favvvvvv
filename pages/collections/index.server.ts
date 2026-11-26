import { defineHandler, defineHead, type InferProps } from "void";
import { z } from "zod";
import { getAllowedUser } from "../../server/access";
import { listCollections } from "../../server/collections";
import { maxCollectionNameLength } from "../../shared/collections";

export const head = defineHead(() => ({ title: "コレクション" }));

export const loader = defineHandler(async (c) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.redirect("/login");
  return { collections: await listCollections(c.env.DB, user.id), email: user.email };
});

export type Props = InferProps<typeof loader>;

export const actions = {
  create: defineHandler.withValidator({
    body: z.object({
      name: z.string().trim().min(1, "コレクション名を入力してください。")
        .max(maxCollectionNameLength, "コレクション名が長すぎます。"),
    }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text("ログインし直してください。", 403);
    const collectionId = crypto.randomUUID();
    const db = c.env.DB;
    const [created] = await db.batch([
      db.prepare(`
        INSERT INTO collections (id, user_id, name, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, name) DO NOTHING RETURNING id
      `).bind(collectionId, user.id, body.name, Date.now()),
      db.prepare(`
        INSERT INTO audit_events (event, user_id, collection_id)
        SELECT 'collection.created', user_id, id FROM collections WHERE id = ? AND user_id = ?
      `).bind(collectionId, user.id),
    ]);
    if (!created.results.length) return c.text("同じ名前のコレクションがあります。", 409);
  }),
};

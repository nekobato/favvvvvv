import { defineHandler, defineHead, type InferProps } from "void";
import { z } from "zod";
import { getAllowedUser } from "../../server/access";
import { addEntryToDashboard, readSavedLinkPage, removeCollectionEntry } from "../../server/collections";

export const head = defineHead(() => ({ title: "コレクション" }));

export const loader = defineHandler(async (c) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.redirect("/login");
  const { id } = c.req.param();
  const collection = await c.env.DB.prepare("SELECT id, name FROM collections WHERE id = ? AND user_id = ?")
    .bind(id, user.id).first<{ id: string; name: string }>();
  if (!collection) return c.notFound();
  const contents = await readSavedLinkPage(c.env.DB, user.id, c.req.query("page"), collection.id);
  return { ...contents, collection, email: user.email };
});

export type Props = InferProps<typeof loader>;
const linkBody = z.object({ linkId: z.uuid() });

export const actions = {
  addToDashboard: defineHandler.withValidator({ body: linkBody })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text("ログインし直してください。", 403);
    const added = await addEntryToDashboard(c.env, user.id, c.req.param().id, body.linkId);
    if (!added) return c.text("コレクション内のリンクが見つかりません。", 404);
  }),
  remove: defineHandler.withValidator({ body: linkBody })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text("ログインし直してください。", 403);
    const removed = await removeCollectionEntry(c.env.DB, user.id, c.req.param().id, body.linkId);
    if (!removed) return c.text("コレクション内のリンクが見つかりません。", 404);
  }),
};

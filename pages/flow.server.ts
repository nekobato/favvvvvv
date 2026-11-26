import { defineHandler, defineHead, type InferProps } from "void";
import { z } from "zod";
import { getAllowedUser } from "../server/access";
import { bookmarkUrl } from "../server/bookmark-input";
import { addCollectionEntry, captureLink, listCollections, readSavedLinkPage } from "../server/collections";
import { shareLoginPath } from "../shared/share";

export const head = defineHead(() => ({ title: "フローリスト" }));

export const loader = defineHandler(async (c) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.redirect(c.req.query("share") === "1" ? shareLoginPath : "/login");
  const [flow, collections] = await Promise.all([
    readSavedLinkPage(c.env.DB, user.id, c.req.query("page")),
    listCollections(c.env.DB, user.id),
  ]);
  return { ...flow, collections, email: user.email };
});

export type Props = InferProps<typeof loader>;

export const actions = {
  capture: defineHandler.withValidator({ body: z.object({ url: bookmarkUrl }) })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text("ログインし直してください。", 403);
    await captureLink(c.env, user.id, body.url);
    return c.redirect("/flow", 303);
  }),
  addToCollection: defineHandler.withValidator({
    body: z.object({ collectionId: z.uuid(), linkId: z.uuid() }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text("ログインし直してください。", 403);
    const added = await addCollectionEntry(c.env.DB, user.id, body.collectionId, body.linkId);
    if (!added) return c.text("リンクまたはコレクションが見つかりません。", 404);
  }),
};

import { defineHandler } from "void";
import { z } from "zod";
import { getAllowedUser } from "../../../server/access";
import { changeBookmarks } from "../../../server/bookmark-bulk";

const fields = {
  ids: z.array(z.uuid()).min(1).refine(ids => new Set(ids).size === ids.length),
  expectedUserId: z.string().min(1).max(128),
};
const bulkBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("move"), groupId: z.uuid().nullable(), sectionId: z.uuid().nullable().default(null), ...fields }),
  z.object({ action: z.literal("delete"), ...fields }),
]).refine(change => change.action !== "move" || !change.groupId || !change.sectionId);

export const POST = defineHandler.withValidator({ body: bulkBody })(async (c, { body }) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);
  if (user.id !== body.expectedUserId) return c.text("ログイン中のアカウントが切り替わりました。", 409);

  const affected = await changeBookmarks(c.env.DB, user.id, body.ids, body);
  if (affected === null) return c.text("選択したブックマークまたは移動先が変更されました。", 409);
  return c.json({ affected });
});

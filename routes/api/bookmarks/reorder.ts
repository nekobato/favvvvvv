import { defineHandler } from "void";
import { z } from "zod";
import { getAllowedUser } from "../../../server/access";
import { reorderDashboard } from "../../../server/dashboard-reorder";

const fields = {
  id: z.uuid(),
  expectedUserId: z.string().min(1).max(128),
  placement: z.union([
    z.object({ side: z.enum(["start", "end"]) }),
    z.object({ side: z.enum(["before", "after"]), anchorId: z.uuid() }),
  ]),
};
const nullableId = z.uuid().nullable();
const reorderBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("section"), ...fields }),
  z.object({ kind: z.literal("group"), ...fields, fromSectionId: nullableId, sectionId: nullableId }),
  z.object({
    kind: z.literal("bookmark"), ...fields,
    fromGroupId: nullableId, groupId: nullableId,
    fromSectionId: nullableId.default(null), sectionId: nullableId.default(null),
  }),
]).refine(move => move.kind !== "bookmark" || ((!move.groupId || !move.sectionId) && (!move.fromGroupId || !move.fromSectionId)));

export const POST = defineHandler.withValidator({ body: reorderBody })(async (c, { body }) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.text("ログインし直してください。", 403);
  if (user.id !== body.expectedUserId) return c.text("ログイン中のアカウントが切り替わりました。", 409);

  if (!await reorderDashboard(c.env.DB, user.id, body)) {
    return c.text("移動元または移動先が変更されました。", 409);
  }
  return c.json({ saved: true });
});

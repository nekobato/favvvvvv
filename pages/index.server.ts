import { auditEvents, auditTimestamp, bookmarkGroups, bookmarkPreviews, bookmarks, dashboardSections } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { and, count, createDb, eq, inArray, sql } from "void/db";
import { z } from "zod";
import { getAllowedUser } from "../server/access";
import { bookmarkTitle, bookmarkUrl } from "../server/bookmark-input";
import { fetchBookmarkPreview, saveBookmarkPreviews } from "../server/bookmark-preview";
import { bookmarkSearchFilter } from "../server/bookmark-search";
import {
  bookmarkGroupLayouts,
  bookmarkLocationKey,
  dashboardColumnCounts,
  maxBookmarkGroupNameLength,
  maxBookmarkTitleLength,
  normalizeBookmarkQuery,
  type BookmarkImageKind,
  type BookmarkLocation,
  type DashboardBookmarkList,
  type DashboardGroup,
  type DashboardSection,
} from "../shared/bookmarks";

const pageSize = 30;
const sessionError = "ログインし直してください。";
const missingBookmark = "対象のブックマークが見つかりません。";
const missingGroup = "対象のグループが見つかりません。";
const missingSection = "対象のセクションが見つかりません。";
const editableId = z.union([z.literal(""), z.uuid()]);
const columns = z.literal(dashboardColumnCounts);

function ownedBookmark(userId: string, bookmarkId: string) {
  return sql`${eq(bookmarks.userId, userId)} AND ${eq(bookmarks.id, bookmarkId)}`;
}

function ownedGroup(userId: string, groupId: string) {
  return and(eq(bookmarkGroups.userId, userId), eq(bookmarkGroups.id, groupId));
}

function ownedSection(userId: string, sectionId: string) {
  return and(eq(dashboardSections.userId, userId), eq(dashboardSections.id, sectionId));
}

function auditFields(
  event: typeof auditEvents.$inferInsert.event,
  userId: typeof bookmarks.userId | typeof bookmarkGroups.userId | typeof dashboardSections.userId,
  ids: {
    bookmarkId?: typeof bookmarks.id;
    groupId?: typeof bookmarks.groupId | typeof bookmarkGroups.id;
    sectionId?: typeof bookmarks.sectionId | typeof bookmarkGroups.sectionId | typeof dashboardSections.id | string;
  },
) {
  return {
    id: sql`NULL`.as("id"),
    occurredAt: auditTimestamp.as("occurred_at"),
    event: sql`${event}`.as("event"),
    userId,
    bookmarkId: ids.bookmarkId ?? sql`NULL`.as("bookmark_id"),
    reason: sql`NULL`.as("reason"),
    groupId: ids.groupId ?? sql`NULL`.as("group_id"),
    collectionId: sql`NULL`.as("collection_id"),
    linkId: sql`NULL`.as("link_id"),
    sectionId: typeof ids.sectionId === "string" ? sql`${ids.sectionId}`.as("section_id")
      : ids.sectionId ?? sql`NULL`.as("section_id"),
  };
}

export const head = defineHead(() => ({ title: "Dashboard" }));

export const loader = defineHandler(async (c) => {
  const user = getAllowedUser(c.env);
  if (!user) return c.redirect("/login");

  const db = createDb(c.env.DB, { session: "first-primary" });
  const query = normalizeBookmarkQuery(c.req.query("q"));
  const filter = bookmarkSearchFilter(user.id, query);
  const [sectionRows, groups, counts] = await db.batch([
    db.select({ id: dashboardSections.id, columns: dashboardSections.columns }).from(dashboardSections)
      .where(eq(dashboardSections.userId, user.id))
      .orderBy(sql`${dashboardSections.sortOrder} asc nulls last`, dashboardSections.createdAt, dashboardSections.id),
    db.select({
      id: bookmarkGroups.id,
      name: bookmarkGroups.name,
      layout: bookmarkGroups.layout,
      columns: bookmarkGroups.columns,
      sectionId: bookmarkGroups.sectionId,
    }).from(bookmarkGroups)
      .where(eq(bookmarkGroups.userId, user.id))
      .orderBy(sql`${bookmarkGroups.sortOrder} asc nulls last`, bookmarkGroups.createdAt, bookmarkGroups.id),
    db.select({ groupId: bookmarks.groupId, sectionId: bookmarks.sectionId, total: count() }).from(bookmarks)
      .where(filter).groupBy(bookmarks.groupId, bookmarks.sectionId),
  ]);
  const totals = new Map(counts.map((location) => [bookmarkLocationKey(location), location.total]));
  const lists = new Map<string, DashboardBookmarkList>();
  const requestedLocation = bookmarkLocationKey({
    groupId: c.req.query("group") ?? null,
    sectionId: c.req.query("section") ?? null,
  });
  const requestedPage = Number(c.req.query("page"));

  function bookmarkList(location: BookmarkLocation): DashboardBookmarkList {
    const key = bookmarkLocationKey(location);
    const total = totals.get(key) ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = key === requestedLocation && Number.isSafeInteger(requestedPage)
      ? Math.max(1, Math.min(pageCount, requestedPage))
      : 1;
    const list = { location, items: [], total, page, pageCount };
    lists.set(key, list);
    return list;
  }

  const sections: DashboardSection[] = sectionRows.map((section) => ({
    ...section,
    groups: [],
    bookmarks: bookmarkList({ groupId: null, sectionId: section.id }),
  }));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const rootGroups: DashboardGroup[] = [];
  let unnamedGroups = 0;
  for (const { sectionId, ...group } of groups) {
    const destination = sectionId === null ? rootGroups : sectionById.get(sectionId)?.groups;
    if (!destination) continue;
    const name = group.name.trim();
    destination.push({
      ...group,
      name,
      label: name || `無題のグループ ${++unnamedGroups}`,
      bookmarks: bookmarkList({ groupId: group.id, sectionId: null }),
    });
  }
  const ungrouped = bookmarkList({ groupId: null, sectionId: null });
  const activeList = lists.get(requestedLocation) ?? ungrouped;
  const pageOffset = (activeList.page - 1) * pageSize;

  // Rank each bookmark list separately so its pagination cannot hide any other list.
  const ranked = db.select({
    id: bookmarks.id,
    title: bookmarks.title,
    url: bookmarks.url,
    groupId: bookmarks.groupId,
    sectionId: bookmarks.sectionId,
    position: sql<number>`row_number() over (
      partition by ${bookmarks.groupId}, ${bookmarks.sectionId}
      order by ${bookmarks.sortOrder} asc, ${bookmarks.createdAt} desc, ${bookmarks.id} desc
    )`.as("position"),
  }).from(bookmarks).where(filter).as("ranked");
  const offset = sql<number>`case when ${ranked.groupId} is ${activeList.location.groupId}
    and ${ranked.sectionId} is ${activeList.location.sectionId} then ${pageOffset} else 0 end`;
  const items = await db.select({
    id: ranked.id,
    title: ranked.title,
    url: ranked.url,
    groupId: ranked.groupId,
    sectionId: ranked.sectionId,
    iconKind: sql<BookmarkImageKind | null>`case when ${bookmarkPreviews.faviconType} is not null then 'favicon'
      when ${bookmarkPreviews.thumbnailType} is not null then 'thumbnail' end`,
    iconRevision: bookmarkPreviews.revision,
  }).from(ranked)
    .leftJoin(bookmarkPreviews, and(eq(bookmarkPreviews.bookmarkId, ranked.id), eq(bookmarkPreviews.url, ranked.url)))
    .where(sql`${ranked.position} > ${offset} and ${ranked.position} <= ${offset} + ${pageSize}`)
    .orderBy(sql`${ranked.position}`);

  for (const { iconKind, iconRevision, ...item } of items) {
    const icon = iconKind && iconRevision ? { kind: iconKind, revision: iconRevision } : null;
    lists.get(bookmarkLocationKey(item))?.items.push({ ...item, icon });
  }
  const total = counts.reduce((sum, group) => sum + group.total, 0);
  return { sections, rootGroups, ungrouped, userId: user.id, email: user.email, query, total };
});

export type Props = InferProps<typeof loader>;

export const actions = {
  save: defineHandler.withValidator({
    body: z.object({
      id: editableId,
      title: z.string().trim().max(maxBookmarkTitleLength, "タイトルが長すぎます。"),
      url: bookmarkUrl,
      groupId: editableId.optional(),
      sectionId: editableId.optional(),
    }).refine(({ groupId, sectionId }) => !groupId || !sectionId, { path: ["sectionId"], message: "登録先を1つ選択してください。" }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text(sessionError, 403);

    const db = createDb(c.env.DB, { session: "first-primary" });
    const ownerFilter = ownedBookmark(user.id, body.id);
    let existingUrl: string | undefined;
    if (body.id) {
      const [existing] = await db.select({ url: bookmarks.url }).from(bookmarks).where(ownerFilter).limit(1);
      if (!existing) return c.text(missingBookmark, 404);
      existingUrl = existing.url;
    }
    const preview = existingUrl !== body.url ? await fetchBookmarkPreview(c.env, body.url) : null;
    const title = bookmarkTitle(body.title || preview?.title || "", body.url);
    const groupId = body.groupId || null;
    const sectionId = body.sectionId || null;
    if (groupId) {
      const [group] = await db.select({ id: bookmarkGroups.id }).from(bookmarkGroups)
        .where(ownedGroup(user.id, groupId)).limit(1);
      if (!group) return c.text(missingGroup, 404);
    }
    if (sectionId) {
      const [section] = await db.select({ id: dashboardSections.id }).from(dashboardSections)
        .where(ownedSection(user.id, sectionId)).limit(1);
      if (!section) return c.text(missingSection, 404);
    }
    const fields = { title, url: body.url };
    if (!body.id) {
      const bookmarkId = crypto.randomUUID();
      await db.batch([
        db.insert(bookmarks).values({
          ...fields,
          groupId,
          sectionId,
          id: bookmarkId,
          userId: user.id,
          createdAt: Date.now(),
        }),
        db.insert(auditEvents).values({ event: "bookmark.created", userId: user.id, bookmarkId, groupId, sectionId }),
      ]);
      await saveBookmarkPreviews(c.env.DB, user.id, [{ id: bookmarkId, url: body.url, preview }]);
      return;
    }

    const changesLocation = body.groupId !== undefined || body.sectionId !== undefined;
    const [updated] = await db.batch([
      db.update(bookmarks).set({
        ...fields,
        groupId: changesLocation ? groupId : undefined,
        sectionId: changesLocation ? sectionId : undefined,
        sortOrder: changesLocation ? sql`case when ${bookmarks.groupId} is ${groupId}
          and ${bookmarks.sectionId} is ${sectionId} then ${bookmarks.sortOrder} else null end` : undefined,
      }).where(ownerFilter).returning({ id: bookmarks.id }),
      db.insert(auditEvents).select(
        db.select(auditFields("bookmark.updated", bookmarks.userId, {
          bookmarkId: bookmarks.id, groupId: bookmarks.groupId, sectionId: bookmarks.sectionId,
        }))
          .from(bookmarks).where(ownerFilter),
      ),
      db.delete(bookmarkPreviews).where(and(
        eq(bookmarkPreviews.bookmarkId, body.id),
        sql`${bookmarkPreviews.url} != ${body.url}`,
        sql`exists (select 1 from ${bookmarks} where ${ownerFilter})`,
      )),
    ]);
    if (!updated.length) return c.text(missingBookmark, 404);
    await saveBookmarkPreviews(c.env.DB, user.id, [{ id: body.id, url: body.url, preview }]);
  }),
  remove: defineHandler.withValidator({
    body: z.object({ id: z.uuid() }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text(sessionError, 403);

    const db = createDb(c.env.DB, { session: "first-primary" });
    const ownerFilter = ownedBookmark(user.id, body.id);
    const [, removed] = await db.batch([
      // The log selects the owned row before the deletion. Both writes commit together.
      db.insert(auditEvents).select(
        db.select(auditFields("bookmark.deleted", bookmarks.userId, {
          bookmarkId: bookmarks.id, groupId: bookmarks.groupId, sectionId: bookmarks.sectionId,
        }))
          .from(bookmarks).where(ownerFilter),
      ),
      db.delete(bookmarks).where(ownerFilter).returning({ id: bookmarks.id }),
    ]);
    if (!removed.length) return c.text(missingBookmark, 404);
  }),
  saveGroup: defineHandler.withValidator({
    body: z.object({
      id: editableId,
      name: z.string().trim().max(maxBookmarkGroupNameLength, "グループ名が長すぎます。").default(""),
      layout: z.enum(bookmarkGroupLayouts),
      columns: columns.optional(),
      sectionId: z.uuid().nullish(),
    }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text(sessionError, 403);

    const db = createDb(c.env.DB, { session: "first-primary" });
    const fields = { name: body.name, layout: body.layout, columns: body.columns };
    if (!body.id) {
      const sectionId = body.sectionId ?? null;
      if (sectionId) {
        const [section] = await db.select({ id: dashboardSections.id }).from(dashboardSections)
          .where(ownedSection(user.id, sectionId)).limit(1);
        if (!section) return c.text(missingSection, 404);
      }
      const groupId = crypto.randomUUID();
      await db.batch([
        db.insert(bookmarkGroups).values({ ...fields, id: groupId, userId: user.id, sectionId, createdAt: Date.now() }),
        db.insert(auditEvents).values({ event: "group.created", userId: user.id, groupId, sectionId }),
      ]);
      return;
    }

    const ownerFilter = ownedGroup(user.id, body.id);
    const [updated] = await db.batch([
      db.update(bookmarkGroups).set(fields).where(ownerFilter).returning({ id: bookmarkGroups.id }),
      db.insert(auditEvents).select(
        db.select(auditFields("group.updated", bookmarkGroups.userId, { groupId: bookmarkGroups.id, sectionId: bookmarkGroups.sectionId }))
          .from(bookmarkGroups).where(ownerFilter),
      ),
    ]);
    if (!updated.length) return c.text(missingGroup, 404);
  }),
  removeGroup: defineHandler.withValidator({
    body: z.object({ id: z.uuid() }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text(sessionError, 403);

    const db = createDb(c.env.DB, { session: "first-primary" });
    const ownerFilter = ownedGroup(user.id, body.id);
    const ownedGroupId = db.select({ id: bookmarkGroups.id }).from(bookmarkGroups).where(ownerFilter);
    const [, , removed] = await db.batch([
      db.insert(auditEvents).select(
        db.select(auditFields("group.deleted", bookmarkGroups.userId, { groupId: bookmarkGroups.id, sectionId: bookmarkGroups.sectionId }))
          .from(bookmarkGroups).where(ownerFilter),
      ),
      db.update(bookmarks).set({ groupId: null, sortOrder: null })
        .where(and(eq(bookmarks.userId, user.id), inArray(bookmarks.groupId, ownedGroupId))),
      db.delete(bookmarkGroups).where(ownerFilter).returning({ id: bookmarkGroups.id }),
    ]);
    if (!removed.length) return c.text(missingGroup, 404);
  }),
  saveSection: defineHandler.withValidator({
    body: z.object({ id: editableId, columns, expectedUserId: z.string().min(1).max(128) }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text(sessionError, 403);
    if (user.id !== body.expectedUserId) return c.text("ログイン中のアカウントが切り替わりました。", 409);

    const db = createDb(c.env.DB, { session: "first-primary" });
    if (!body.id) {
      const sectionId = crypto.randomUUID();
      await db.batch([
        db.insert(dashboardSections).values({ id: sectionId, userId: user.id, columns: body.columns, createdAt: Date.now() }),
        db.insert(auditEvents).values({ event: "section.created", userId: user.id, sectionId }),
      ]);
      return;
    }

    const ownerFilter = ownedSection(user.id, body.id);
    const [updated] = await db.batch([
      db.update(dashboardSections).set({ columns: body.columns }).where(ownerFilter).returning({ id: dashboardSections.id }),
      db.insert(auditEvents).select(
        db.select(auditFields("section.updated", dashboardSections.userId, { sectionId: dashboardSections.id }))
          .from(dashboardSections).where(ownerFilter),
      ),
    ]);
    if (!updated.length) return c.text(missingSection, 404);
  }),
  removeSection: defineHandler.withValidator({
    body: z.object({ id: z.uuid(), expectedUserId: z.string().min(1).max(128) }),
  })(async (c, { body }) => {
    const user = getAllowedUser(c.env);
    if (!user) return c.text(sessionError, 403);
    if (user.id !== body.expectedUserId) return c.text("ログイン中のアカウントが切り替わりました。", 409);

    const db = createDb(c.env.DB, { session: "first-primary" });
    const ownerFilter = ownedSection(user.id, body.id);
    const sectionIds = db.select({ id: dashboardSections.id }).from(dashboardSections).where(ownerFilter);
    const groupFilter = and(eq(bookmarkGroups.userId, user.id), inArray(bookmarkGroups.sectionId, sectionIds));
    const groupIds = db.select({ id: bookmarkGroups.id }).from(bookmarkGroups).where(groupFilter);
    const bookmarkFilter = and(eq(bookmarks.userId, user.id), sql`(
      ${inArray(bookmarks.sectionId, sectionIds)} or ${inArray(bookmarks.groupId, groupIds)}
    )`);
    const [, , , , , removed] = await db.batch([
      db.insert(auditEvents).select(db.select(auditFields("bookmark.deleted", bookmarks.userId, {
        bookmarkId: bookmarks.id, groupId: bookmarks.groupId, sectionId: body.id,
      })).from(bookmarks).where(bookmarkFilter)),
      db.insert(auditEvents).select(db.select(auditFields("group.deleted", bookmarkGroups.userId, {
        groupId: bookmarkGroups.id, sectionId: bookmarkGroups.sectionId,
      })).from(bookmarkGroups).where(groupFilter)),
      db.insert(auditEvents).select(db.select(auditFields("section.deleted", dashboardSections.userId, {
        sectionId: dashboardSections.id,
      })).from(dashboardSections).where(ownerFilter)),
      db.delete(bookmarks).where(bookmarkFilter),
      db.delete(bookmarkGroups).where(groupFilter),
      db.delete(dashboardSections).where(ownerFilter).returning({ id: dashboardSections.id }),
    ]);
    if (!removed.length) return c.text(missingSection, 404);
  }),
};

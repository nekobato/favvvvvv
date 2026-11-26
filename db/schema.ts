import { blob, check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "void/schema-d1";
import { sql } from "void/db";
import { userTable } from "../.void/better-auth-schema";
import { bookmarkGroupLayouts, defaultBookmarkGroupLayout, type DashboardColumnCount } from "../shared/bookmarks";

export const dashboardSections = sqliteTable("dashboard_sections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  columns: integer("column_count").$type<DashboardColumnCount>().notNull().default(1),
  createdAt: integer("created_at").notNull(),
  sortOrder: integer("sort_order"),
}, (table) => [
  check("dashboard_sections_column_count", sql`${table.columns} in (1, 2, 3)`),
  index("dashboard_sections_user_sort_idx").on(table.userId, table.sortOrder, table.createdAt, table.id),
]);

export const bookmarkGroups = sqliteTable("bookmark_groups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  layout: text("layout", { enum: bookmarkGroupLayouts }).notNull().default(defaultBookmarkGroupLayout),
  columns: integer("column_count").$type<DashboardColumnCount>().notNull().default(1),
  sectionId: text("section_id").references(() => dashboardSections.id),
  createdAt: integer("created_at").notNull(),
  sortOrder: integer("sort_order"),
}, (table) => [
  index("bookmark_groups_user_created_idx").on(table.userId, table.createdAt, table.id),
  index("bookmark_groups_user_sort_idx").on(table.userId, table.sortOrder, table.createdAt, table.id),
  check("bookmark_groups_column_count", sql`${table.columns} in (1, 2, 3)`),
  index("bookmark_groups_user_section_sort_idx").on(table.userId, table.sectionId, table.sortOrder),
]);

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  createdAt: integer("created_at").notNull(),
  groupId: text("group_id").references(() => bookmarkGroups.id, { onDelete: "set null" }),
  sectionId: text("section_id").references(() => dashboardSections.id),
  sortOrder: integer("sort_order"),
}, (table) => [
  index("bookmarks_user_created_id_idx").on(table.userId, table.createdAt, table.id),
  index("bookmarks_user_url_idx").on(table.userId, table.url),
  index("bookmarks_user_group_created_idx").on(table.userId, table.groupId, table.createdAt, table.id),
  index("bookmarks_user_group_sort_idx").on(table.userId, table.groupId, table.sortOrder),
  check("bookmarks_single_parent", sql`${table.groupId} is null or ${table.sectionId} is null`),
  index("bookmarks_user_section_sort_idx").on(table.userId, table.sectionId, table.sortOrder),
]);

export const bookmarkPreviews = sqliteTable("bookmark_previews", {
  bookmarkId: text("bookmark_id").primaryKey().notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  revision: text("revision").notNull(),
  faviconType: text("favicon_type"),
  favicon: blob("favicon", { mode: "buffer" }),
  thumbnailType: text("thumbnail_type"),
  thumbnail: blob("thumbnail", { mode: "buffer" }),
});

export const savedLinks = sqliteTable("saved_links", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  thumbnailType: text("thumbnail_type"),
  thumbnail: blob("thumbnail", { mode: "buffer" }),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("saved_links_user_id_idx").on(table.userId, table.id),
  uniqueIndex("saved_links_user_url_idx").on(table.userId, table.url),
  index("saved_links_user_created_idx").on(table.userId, table.createdAt, table.id),
]);

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("collections_user_id_idx").on(table.userId, table.id),
  uniqueIndex("collections_user_name_idx").on(table.userId, table.name),
]);

export const collectionEntries = sqliteTable("collection_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  collectionId: text("collection_id").notNull(),
  linkId: text("link_id").notNull(),
  addedAt: integer("added_at").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.userId, table.collectionId],
    foreignColumns: [collections.userId, collections.id],
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.userId, table.linkId],
    foreignColumns: [savedLinks.userId, savedLinks.id],
  }).onDelete("cascade"),
  uniqueIndex("collection_entries_collection_link_idx").on(table.collectionId, table.linkId),
  index("collection_entries_user_collection_added_idx").on(table.userId, table.collectionId, table.addedAt, table.id),
  index("collection_entries_user_link_idx").on(table.userId, table.linkId),
]);

export const auditTimestamp = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  occurredAt: text("occurred_at").notNull().default(auditTimestamp),
  event: text("event", {
    enum: [
      "bookmark.created",
      "bookmark.updated",
      "bookmark.deleted",
      "group.created",
      "group.updated",
      "group.deleted",
      "section.created",
      "section.updated",
      "section.deleted",
      "link.captured",
      "collection.created",
      "collection.link_added",
      "collection.link_removed",
      "auth.session_started",
      "auth.session_ended",
      "auth.sign_in_denied",
    ],
  }).notNull(),
  userId: text("user_id"),
  bookmarkId: text("bookmark_id"),
  reason: text("reason", { enum: ["email_unverified", "not_allowlisted"] }),
  groupId: text("group_id"),
  collectionId: text("collection_id"),
  linkId: text("link_id"),
  sectionId: text("section_id"),
});

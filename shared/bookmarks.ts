export const maxBookmarkTitleLength = 240;
export const maxBookmarkUrlLength = 8192;
export const maxBookmarkSearchLength = 200;
export const maxBookmarkGroupNameLength = 80;
export const bookmarkImportBatchSize = 100;
export const bookmarkImportPreviewLookupLimit = 3;

export function normalizeBookmarkQuery(query = "") {
  return query.trim().slice(0, maxBookmarkSearchLength);
}

export const bookmarkGroupLayouts = ["icon-large", "icon-small", "list-large", "list-small"] as const;
export type BookmarkGroupLayout = (typeof bookmarkGroupLayouts)[number];
export const defaultBookmarkGroupLayout = "list-small" satisfies BookmarkGroupLayout;

export const dashboardColumnCounts = [1, 2, 3] as const;
export type DashboardColumnCount = (typeof dashboardColumnCounts)[number];

export type BookmarkImageKind = "favicon" | "thumbnail";

export type BookmarkLocation = {
  groupId: string | null;
  sectionId: string | null;
};

export type BookmarkDestination = BookmarkLocation & { label: string };

export function bookmarkLocationKey({ groupId, sectionId }: BookmarkLocation) {
  return groupId ? `group-${groupId}` : sectionId ? `section-${sectionId}` : "ungrouped";
}

export type BookmarkItem = BookmarkLocation & {
  id: string;
  title: string;
  url: string;
  icon: { kind: BookmarkImageKind; revision: string } | null;
};

export type BookmarkSearchResult = {
  items: Pick<BookmarkItem, "id" | "title" | "url">[];
  hasMore: boolean;
};

export type DashboardBookmarkList = {
  location: BookmarkLocation;
  items: BookmarkItem[];
  total: number;
  page: number;
  pageCount: number;
};

export type DashboardGroup = {
  id: string;
  name: string;
  label: string;
  layout: BookmarkGroupLayout;
  columns: DashboardColumnCount;
  bookmarks: DashboardBookmarkList;
};

export type DashboardSection = {
  id: string;
  columns: DashboardColumnCount;
  groups: DashboardGroup[];
  bookmarks: DashboardBookmarkList;
};

export type ReorderPlacement =
  | { side: "start" | "end" }
  | { side: "before" | "after"; anchorId: string };

export type DashboardMove =
  | { kind: "section"; id: string; placement: ReorderPlacement }
  | { kind: "group"; id: string; fromSectionId: string | null; sectionId: string | null; placement: ReorderPlacement }
  | ({ kind: "bookmark"; id: string; fromGroupId: string | null; fromSectionId: string | null; placement: ReorderPlacement } & BookmarkLocation);

export type BookmarkBulkChange = { action: "delete" } | ({ action: "move" } & BookmarkLocation);

export type BookmarkImportItem = {
  title: string;
  url: string;
};

export type BookmarkImportResult = {
  imported: number;
  duplicates: number;
  skipped: number;
};

import type { BookmarkLocation, DashboardMove, ReorderPlacement } from "../shared/bookmarks";

export type ReorderSource = { id: string; title: string } & (
  | { kind: "section" }
  | { kind: "group"; sectionId: string | null }
  | ({ kind: "bookmark" } & BookmarkLocation)
);

export type ReorderTarget = { placement: ReorderPlacement } & (
  | { kind: "section" }
  | { kind: "group"; sectionId: string | null }
  | ({ kind: "bookmark" } & BookmarkLocation)
);

export function moveTo(source: ReorderSource, target: ReorderTarget): DashboardMove | undefined {
  const { placement } = target;
  if ("anchorId" in placement && placement.anchorId === source.id) return;
  if (source.kind === "section" && target.kind === "section") {
    return { kind: "section", id: source.id, placement };
  }
  if (source.kind === "group" && target.kind === "group") {
    return { kind: "group", id: source.id, fromSectionId: source.sectionId, sectionId: target.sectionId, placement };
  }
  if (source.kind === "bookmark" && target.kind === "bookmark") {
    return {
      kind: "bookmark", id: source.id, placement,
      fromGroupId: source.groupId, fromSectionId: source.sectionId,
      groupId: target.groupId, sectionId: target.sectionId,
    };
  }
}

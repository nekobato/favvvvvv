import { bookmarks } from "@schema";
import { and, eq, sql } from "void/db";

export function bookmarkSearchFilter(userId: string, query: string) {
  return and(
    eq(bookmarks.userId, userId),
    query ? sql`(instr(lower(${bookmarks.title}), lower(${query})) > 0
      OR instr(lower(${bookmarks.url}), lower(${query})) > 0)` : undefined,
  );
}

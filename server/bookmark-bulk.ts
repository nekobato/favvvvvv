import type { BookmarkBulkChange } from "../shared/bookmarks";

export async function changeBookmarks(db: D1Database, userId: string, ids: string[], change: BookmarkBulkChange) {
  const moving = change.action === "move";
  const parameters = [JSON.stringify(ids), userId, ...(moving ? [change.groupId, change.sectionId] : [])];
  const selection = `
    WITH owned AS MATERIALIZED (
      SELECT bookmark.id, bookmark.group_id, bookmark.section_id, bookmark.sort_order, bookmark.created_at
      FROM json_each(?1) AS requested
      JOIN bookmarks AS bookmark ON bookmark.id = requested.value
      WHERE bookmark.user_id = ?2
    ), validity AS (
      SELECT count(*) = json_array_length(?1) ${moving ? `
        AND (?3 IS NULL OR EXISTS (SELECT 1 FROM bookmark_groups WHERE id = ?3 AND user_id = ?2))
        AND (?4 IS NULL OR EXISTS (SELECT 1 FROM dashboard_sections WHERE id = ?4 AND user_id = ?2))
      ` : ""} AS valid
      FROM owned
    ), targets AS MATERIALIZED (
      SELECT * FROM owned
      WHERE (SELECT valid FROM validity) ${moving ? "AND (group_id IS NOT ?3 OR section_id IS NOT ?4)" : ""}
    )
  `;
  const session = db.withSession("first-primary");

  // Recheck eligibility in each statement so an invalid selection has no side effects.
  const [checked, , mutation] = await session.batch<{ valid: 0 | 1 }>([
    session.prepare(`${selection} SELECT valid FROM validity`).bind(...parameters),
    session.prepare(`
      ${selection}
      INSERT INTO audit_events (event, user_id, bookmark_id, group_id, section_id)
      SELECT ${moving ? "'bookmark.updated', ?2, id, ?3, ?4" : "'bookmark.deleted', ?2, id, group_id, section_id"}
      FROM targets
    `).bind(...parameters),
    session.prepare(moving ? `
      ${selection}, positioned AS MATERIALIZED (
        SELECT targets.id, row_number() OVER (
          ORDER BY CASE WHEN section.id IS NOT NULL THEN 1 WHEN source.id IS NOT NULL THEN 0 ELSE 2 END,
            section.sort_order ASC NULLS LAST, section.created_at, section.id,
            source.id IS NULL, source.sort_order ASC NULLS LAST, source.created_at, source.id,
            targets.sort_order ASC, targets.created_at DESC, targets.id DESC
        ) + (
          SELECT coalesce(max(sort_order), 0) FROM bookmarks WHERE user_id = ?2 AND group_id IS ?3 AND section_id IS ?4
        ) AS position
        FROM targets
        LEFT JOIN bookmark_groups AS source ON source.id = targets.group_id AND source.user_id = ?2
        LEFT JOIN dashboard_sections AS section ON section.id = coalesce(targets.section_id, source.section_id) AND section.user_id = ?2
      )
      UPDATE bookmarks AS bookmark SET group_id = ?3, section_id = ?4, sort_order = positioned.position
      FROM positioned WHERE bookmark.id = positioned.id AND bookmark.user_id = ?2
    ` : `
      ${selection}
      DELETE FROM bookmarks WHERE user_id = ?2 AND id IN (SELECT id FROM targets)
    `).bind(...parameters),
  ]);

  return checked.results[0]?.valid ? mutation.meta.changes : null;
}

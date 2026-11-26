import type { DashboardMove } from "../shared/bookmarks";

export async function reorderDashboard(db: D1Database, userId: string, move: DashboardMove) {
  const bookmark = move.kind === "bookmark";
  const group = move.kind === "group";
  const table = bookmark ? "bookmarks" : group ? "bookmark_groups" : "dashboard_sections";
  const orderBy = bookmark ? "sort_order ASC, created_at DESC, id DESC" : "sort_order ASC NULLS LAST, created_at, id";
  const destination = bookmark ? "AND group_id IS ?6 AND section_id IS ?8" : group ? "AND section_id IS ?6" : "";
  const source = bookmark ? `
    AND group_id IS ?5
    AND section_id IS ?7
    AND (?6 IS NULL OR EXISTS (SELECT 1 FROM bookmark_groups WHERE user_id = ?1 AND id = ?6))
    AND (?8 IS NULL OR EXISTS (SELECT 1 FROM dashboard_sections WHERE user_id = ?1 AND id = ?8))
  ` : group ? `
    AND section_id IS ?5
    AND (?6 IS NULL OR EXISTS (SELECT 1 FROM dashboard_sections WHERE user_id = ?1 AND id = ?6))
  ` : "";
  const parentUpdates = bookmark ? ", group_id = ?6, section_id = ?8" : group ? ", section_id = ?6" : "";
  const auditIds = bookmark ? "id, group_id, section_id" : group ? "NULL, id, section_id" : "NULL, NULL, id";
  const { placement } = move;
  const session = db.withSession("first-primary");

  // Resolve the anchor against the full destination, including rows outside the current page or search.
  const [updated] = await session.batch([
    session.prepare(`
      WITH ranked AS MATERIALIZED (
        SELECT id, row_number() OVER (ORDER BY ${orderBy}) AS position
        FROM ${table}
        WHERE user_id = ?1 AND id <> ?2 ${destination}
      ), insertion AS MATERIALIZED (
        SELECT CASE ?3
          WHEN 'start' THEN 1
          WHEN 'end' THEN (SELECT count(*) + 1 FROM ranked)
          ELSE (SELECT position + (?3 = 'after') FROM ranked WHERE id = ?4)
        END AS position
        FROM ${table}
        WHERE user_id = ?1 AND id = ?2 ${source}
      ), new_order AS MATERIALIZED (
        SELECT ranked.id, ranked.position + (ranked.position >= insertion.position) AS position
        FROM ranked CROSS JOIN insertion
        WHERE insertion.position IS NOT NULL
        UNION ALL
        SELECT ?2, position FROM insertion WHERE position IS NOT NULL
      )
      UPDATE ${table} AS item
      SET sort_order = new_order.position ${parentUpdates}
      FROM new_order
      WHERE item.user_id = ?1 AND item.id = new_order.id
        AND (item.id = ?2 OR item.sort_order IS NOT new_order.position)
    `).bind(userId, move.id, placement.side, "anchorId" in placement ? placement.anchorId : null,
      ...(bookmark ? [move.fromGroupId, move.groupId, move.fromSectionId, move.sectionId]
        : group ? [move.fromSectionId, move.sectionId] : [])),
    session.prepare(`
      INSERT INTO audit_events (event, user_id, bookmark_id, group_id, section_id)
      SELECT ?3, user_id, ${auditIds}
      FROM ${table}
      WHERE user_id = ?1 AND id = ?2 AND changes() > 0
    `).bind(userId, move.id, `${move.kind}.updated`),
  ]);
  return updated.meta.changes > 0;
}

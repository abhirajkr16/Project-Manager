import { query } from "../db/index.js";

export const logActivity = async (
  client,
  { userId, projectId, action, metadata },
) => {
  try {
    const result = await client.query(
      `
      INSERT INTO activity_logs (
        user_id,
        project_id,
        action,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        user_id,
        project_id,
        action,
        metadata,
        created_at::text AS created_at
      `,
      [
        userId || null,
        projectId || null,
        action,
        JSON.stringify(metadata || {}),
      ],
    );

    return result.rows[0];
  } catch (error) {
    console.error("Log activity error:", error);
    throw error;
  }
};

export const getActivityLogs = async (client, projectId, limit = 50) => {
  try {
    const result = await client.query(
      `
      SELECT
        al.*,
        u.name AS user_name
      FROM activity_logs al
      LEFT JOIN users u
        ON al.user_id = u.id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
      `,
      [projectId, limit],
    );

    return result.rows;
  } catch (error) {
    console.error("Get activity logs error:", error);
    throw error;
  }
};

export const getMissedActivityLogs = async (
  user,
  lastSeenAt = null,
  lastSeenId = null,
  limit = 20,
) => {
  try {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 20);

    const validDate =
      lastSeenAt && !Number.isNaN(Date.parse(lastSeenAt)) ? lastSeenAt : null;

    const validId =
      typeof lastSeenId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        lastSeenId,
      )
        ? lastSeenId
        : null;

    let result;

    if (user.role === "admin") {
      result = await query(
        `
        SELECT
          al.id,
          al.user_id,
          al.project_id,
          al.action,
          al.metadata,
          al.created_at::text AS created_at,
          u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u
          ON u.id = al.user_id
        WHERE (
          $1::timestamptz IS NULL
          OR al.created_at > $1::timestamptz
          OR (
            al.created_at = $1::timestamptz
            AND $2::uuid IS NOT NULL
            AND al.id > $2::uuid
          )
        )
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $3
        `,
        [validDate, validId, safeLimit],
      );
    } else if (user.role === "project_manager") {
      result = await query(
        `
        SELECT
          al.id,
          al.user_id,
          al.project_id,
          al.action,
          al.metadata,
          al.created_at::text AS created_at,
          u.name AS user_name
        FROM activity_logs al
        JOIN projects p
          ON p.id = al.project_id
        LEFT JOIN users u
          ON u.id = al.user_id
        WHERE p.owner_id = $1
          AND (
            $2::timestamptz IS NULL
            OR al.created_at > $2::timestamptz
            OR (
              al.created_at = $2::timestamptz
              AND $3::uuid IS NOT NULL
              AND al.id > $3::uuid
            )
          )
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $4
        `,
        [user.id, validDate, validId, safeLimit],
      );
    } else if (user.role === "developer") {
      result = await query(
        `
        SELECT
          al.id,
          al.user_id,
          al.project_id,
          al.action,
          al.metadata,
          al.created_at::text AS created_at,
          u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u
          ON u.id = al.user_id
        WHERE EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.id::text = al.metadata->>'taskId'
            AND t.assigned_to = $1
        )
        AND (
          $2::timestamptz IS NULL
          OR al.created_at > $2::timestamptz
          OR (
            al.created_at = $2::timestamptz
            AND $3::uuid IS NOT NULL
            AND al.id > $3::uuid
          )
        )
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $4
        `,
        [user.id, validDate, validId, safeLimit],
      );
    } else {
      return [];
    }

    return result.rows;
  } catch (error) {
    console.error("Get missed activity logs error:", error);

    throw error;
  }
};

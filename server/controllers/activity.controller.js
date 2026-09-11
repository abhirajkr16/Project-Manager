import { query } from "../db/index.js";

export const getMyActivity = async (req, res) => {
  const { role, id: userId } = req.user;
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 50);

  try {
    let result;

    if (role === "admin") {
      result = await query(
        `
        SELECT
          al.id,
          al.user_id,
          al.project_id,
          al.action,
          al.metadata,
          al.created_at,
          u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u
          ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT $1
        `,
        [limit],
      );
    } else if (role === "project_manager") {
      result = await query(
        `
        SELECT
          al.id,
          al.user_id,
          al.project_id,
          al.action,
          al.metadata,
          al.created_at,
          u.name AS user_name
        FROM activity_logs al
        JOIN projects p
          ON p.id = al.project_id
        LEFT JOIN users u
          ON u.id = al.user_id
        WHERE p.owner_id = $1
        ORDER BY al.created_at DESC
        LIMIT $2
        `,
        [userId, limit],
      );
    } else if (role === "developer") {
      result = await query(
        `
        SELECT
          al.id,
          al.user_id,
          al.project_id,
          al.action,
          al.metadata,
          al.created_at,
          u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u
          ON u.id = al.user_id
        WHERE EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.id = NULLIF(al.metadata->>'taskId', '')::uuid
            AND t.assigned_to = $1
        )
        ORDER BY al.created_at DESC
        LIMIT $2
        `,
        [userId, limit],
      );
    } else {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    res.json({
      activities: result.rows,
    });
  } catch (error) {
    console.error("Get activity error:", error);

    res.status(500).json({
      error: "Failed to fetch activity",
    });
  }
};

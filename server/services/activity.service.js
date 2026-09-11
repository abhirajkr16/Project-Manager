export const logActivity = async (
  client,
  { userId, projectId, action, metadata },
) => {
  try {
    await client.query(
      `
      INSERT INTO activity_logs (
        user_id,
        project_id,
        action,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        userId || null,
        projectId || null,
        action,
        JSON.stringify(metadata || {}),
      ],
    );
  } catch (error) {
    console.error("Log activity error:", error);
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

import { query } from "../db/index.js";

export const getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `
      SELECT
        id,
        user_id,
        type,
        title,
        message,
        metadata,
        read_at,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId],
    );

    const unreadResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = $1
        AND read_at IS NULL
      `,
      [userId],
    );

    res.json({
      notifications: result.rows,
      unreadCount: unreadResult.rows[0].count,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      error: "Failed to fetch notifications",
    });
  }
};

export const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await query(
      `
      UPDATE notifications
      SET read_at = COALESCE(read_at, now())
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        user_id,
        type,
        title,
        message,
        metadata,
        read_at,
        created_at
      `,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    res.json({
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    res.status(500).json({
      error: "Failed to mark notification as read",
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    await query(
      `
      UPDATE notifications
      SET read_at = now()
      WHERE user_id = $1
        AND read_at IS NULL
      `,
      [userId],
    );

    res.json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    res.status(500).json({
      error: "Failed to mark notifications as read",
    });
  }
};

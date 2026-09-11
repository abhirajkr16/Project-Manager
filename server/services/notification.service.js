export const createNotification = async (
  client,
  { userId, type, title, message, metadata = {} },
) => {
  const result = await client.query(
    `
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
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
    [userId, type, title, message, JSON.stringify(metadata)],
  );

  return result.rows[0];
};

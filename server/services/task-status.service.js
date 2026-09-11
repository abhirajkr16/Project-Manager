import { query } from "../db/index.js";

export async function recordStatusChange({
  taskId,
  changedBy,
  oldStatus,
  newStatus,
}) {
  await query(
    `
    INSERT INTO task_status_history (
      task_id,
      changed_by,
      old_status,
      new_status
    )
    VALUES ($1, $2, $3, $4)
    `,
    [taskId, changedBy, oldStatus, newStatus],
  );
}

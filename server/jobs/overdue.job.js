import cron from "node-cron";
import { transaction } from "../db/index.js";
import { logActivity } from "../services/activity.service.js";

export function startOverdueJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      await transaction(async (client) => {
        const result = await client.query(
          `
          SELECT
            id,
            project_id,
            title
          FROM tasks
          WHERE due_date < now()
            AND status != 'done'
            AND overdue = false
          `,
        );

        if (result.rows.length === 0) {
          return;
        }

        for (const task of result.rows) {
          await client.query(
            `
            UPDATE tasks
            SET
              overdue = true,
              updated_at = now()
            WHERE id = $1
            `,
            [task.id],
          );

          await logActivity(client, {
            userId: null,
            projectId: task.project_id,
            action: "task_overdue",
            metadata: {
              taskId: task.id,
              taskTitle: task.title,
            },
          });
        }

        console.log(`Marked ${result.rows.length} task(s) as overdue`);
      });
    } catch (error) {
      console.error("Overdue job error:", error);
    }
  });

  console.log("Overdue background job started");
}

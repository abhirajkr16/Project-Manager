import cron from "node-cron";
import { query } from "../db/index.js";

export function startOverdueJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await query(
        `
        UPDATE tasks
        SET overdue = true,
            updated_at = now()
        WHERE due_date < now()
          AND status != 'done'
          AND overdue = false
        RETURNING id, project_id, title
        `,
      );

      if (result.rows.length > 0) {
        console.log(`Marked ${result.rows.length} task(s) as overdue`);
      }
    } catch (error) {
      console.error("Overdue job error:", error);
    }
  });

  console.log("Overdue background job started");
}

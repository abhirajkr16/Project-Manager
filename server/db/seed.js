import bcrypt from "bcrypt";
import { transaction } from "./index.js";

async function seed() {
  console.log("Seeding database...\n");

  try {
    await transaction(async (client) => {
      const password = await bcrypt.hash("user123", 12);

      const users = [
        ["Admin User", "admin@example.com", "admin", "admin123"],
        ["Alice Johnson", "alice@example.com", "project_manager", "user123"],
        ["Bob Smith", "bob@example.com", "project_manager", "user123"],
        ["Ravi Kumar", "ravi@example.com", "developer", "user123"],
        ["Amit Sharma", "amit@example.com", "developer", "user123"],
        ["Neha Singh", "neha@example.com", "developer", "user123"],
        ["Priya Verma", "priya@example.com", "developer", "user123"],
      ];

      const userIds = {};

      for (const [name, email, role, userPassword] of users) {
        const passwordHash = await bcrypt.hash(userPassword, 12);

        const result = await client.query(
          `INSERT INTO users (name, email, password_hash, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email)
           DO UPDATE SET
             name = EXCLUDED.name,
             role = EXCLUDED.role
           RETURNING id`,
          [name, email, passwordHash, role],
        );

        userIds[email] = result.rows[0].id;
      }

      console.log("Users created");

      const clients = [
        ["Acme Corporation", "contact@acme.com"],
        ["TechNova Solutions", "contact@technova.com"],
        ["Global Retail Ltd", "contact@globalretail.com"],
      ];

      const clientIds = [];

      for (const [name, email] of clients) {
        const result = await client.query(
          `INSERT INTO clients (name, email)
           VALUES ($1, $2)
           ON CONFLICT (email)
           DO UPDATE SET
             name = EXCLUDED.name
           RETURNING id`,
          [name, email],
        );

        clientIds.push(result.rows[0].id);
      }

      console.log("Clients created");

      const projectData = [
        {
          owner: userIds["alice@example.com"],
          client: clientIds[0],
          title: "Website Redesign",
          description: "Redesign the company website",
        },
        {
          owner: userIds["alice@example.com"],
          client: clientIds[1],
          title: "Mobile Application",
          description: "Build the mobile application",
        },
        {
          owner: userIds["bob@example.com"],
          client: clientIds[2],
          title: "E-commerce Platform",
          description: "Develop the new e-commerce platform",
        },
      ];

      const projectIds = [];

      for (const project of projectData) {
        const result = await client.query(
          `INSERT INTO projects (owner_id, client_id, title, description)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [project.owner, project.client, project.title, project.description],
        );

        projectIds.push(result.rows[0].id);
      }

      console.log("Projects created");

      const developers = [
        userIds["ravi@example.com"],
        userIds["amit@example.com"],
        userIds["neha@example.com"],
        userIds["priya@example.com"],
      ];

      const taskData = [
        ["Design homepage", "todo", "high", developers[0], 7],
        ["Build navigation", "in-progress", "high", developers[1], 5],
        ["Create contact form", "in-review", "medium", developers[2], 3],
        ["Write documentation", "done", "low", developers[3], -2],
        ["Setup analytics", "todo", "medium", developers[0], 10],

        ["Create login screen", "in-progress", "critical", developers[1], 4],
        ["Implement authentication", "todo", "high", developers[2], 8],
        ["Build dashboard", "in-review", "high", developers[3], 6],
        ["Add push notifications", "todo", "medium", developers[0], 12],
        ["Test application", "done", "low", developers[1], -1],

        ["Product listing", "todo", "critical", developers[2], 2],
        ["Shopping cart", "in-progress", "high", developers[3], 5],
        ["Payment integration", "todo", "critical", developers[0], 9],
        ["Order management", "in-review", "medium", developers[1], 3],
        ["E-commerce testing", "done", "low", developers[2], -3],
      ];

      for (let i = 0; i < taskData.length; i++) {
        const [title, status, priority, assignedTo, daysFromNow] = taskData[i];

        const projectId = projectIds[Math.floor(i / 5)];

        const dueDate = new Date(
          Date.now() + daysFromNow * 24 * 60 * 60 * 1000,
        );

        const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

        const result = await client.query(
          `INSERT INTO tasks (
            project_id,
            title,
            description,
            status,
            priority,
            assigned_to,
            due_date,
            overdue,
            created_by,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            projectId,
            title,
            `Task for ${title}`,
            status,
            priority,
            assignedTo,
            dueDate,
            daysFromNow < 0 && status !== "done",
            projectData[Math.floor(i / 5)].owner,
            createdAt,
          ],
        );

        const taskId = result.rows[0].id;

        await client.query(
          `INSERT INTO task_status_history (
            task_id,
            changed_by,
            old_status,
            new_status
          )
          VALUES ($1, $2, $3, $4)`,
          [taskId, assignedTo, null, status],
        );

        await client.query(
          `INSERT INTO activity_logs (
            user_id,
            project_id,
            action,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5)`,
          [
            assignedTo,
            projectId,
            "create_task",
            JSON.stringify({
              taskId,
              title,
              status,
              priority,
            }),
            createdAt,
          ],
        );
      }

      console.log("Tasks, history and activity created");

      const notificationData = [
        [
          userIds["ravi@example.com"],
          "task_assigned",
          "New task assigned",
          "You have been assigned a new task",
        ],
        [
          userIds["amit@example.com"],
          "task_assigned",
          "New task assigned",
          "You have been assigned a new task",
        ],
        [
          userIds["alice@example.com"],
          "task_in_review",
          "Task moved to In Review",
          "A developer moved a task to In Review",
        ],
      ];

      for (const notification of notificationData) {
        await client.query(
          `INSERT INTO notifications (
            user_id,
            type,
            title,
            message
          )
          VALUES ($1, $2, $3, $4)`,
          notification,
        );
      }

      console.log("Notifications created");
    });

    console.log("\nDatabase seeded successfully!");
    console.log("\nTest credentials:");
    console.log("Admin: admin@example.com / admin123");
    console.log("PM: alice@example.com / user123");
    console.log("PM: bob@example.com / user123");
    console.log("Developer: ravi@example.com / user123");
    console.log("Developer: amit@example.com / user123");
    console.log("Developer: neha@example.com / user123");
    console.log("Developer: priya@example.com / user123");

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();

import { query, transaction } from "../db/index.js";
import { logActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";

import {
  broadcastActivity,
  broadcastTaskCreated,
  broadcastTaskUpdated,
  broadcastTaskDeleted,
  broadcastNotification,
} from "../services/realtime.service.js";

async function checkProjectAccess(req, projectId) {
  if (req.user.role === "admin") {
    return true;
  }

  if (req.user.role !== "project_manager") {
    return false;
  }

  const result = await query(
    `
    SELECT id
    FROM projects
    WHERE id = $1
      AND owner_id = $2
    `,
    [projectId, req.user.id],
  );

  return result.rows.length > 0;
}

export async function getTasks(req, res) {
  try {
    const { projectId } = req.params;

    const hasAccess = await checkProjectAccess(req, projectId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "You do not have access to this project",
      });
    }

    const result = await query(
      `
      SELECT
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assigned_to,
        t.due_date,
        t.overdue,
        t.created_at,
        t.updated_at,
        u.name AS assigned_developer
      FROM tasks t
      LEFT JOIN users u
        ON u.id = t.assigned_to
      WHERE t.project_id = $1
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date NULLS LAST,
        t.created_at DESC
      `,
      [projectId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get tasks error:", error);

    res.status(500).json({
      error: "Failed to fetch tasks",
    });
  }
}

export async function getMyTasks(req, res) {
  try {
    const result = await query(
      `
      SELECT
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assigned_to,
        t.due_date,
        t.overdue,
        t.created_at,
        t.updated_at,
        p.title AS project_title
      FROM tasks t
      JOIN projects p
        ON p.id = t.project_id
      WHERE t.assigned_to = $1
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date NULLS LAST
      `,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get my tasks error:", error);

    res.status(500).json({
      error: "Failed to fetch tasks",
    });
  }
}

export async function createTask(req, res) {
  try {
    const { projectId } = req.params;

    const { title, description, assignedTo, status, priority, dueDate } =
      req.body;

    const hasAccess = await checkProjectAccess(req, projectId);

    if (!hasAccess) {
      return res.status(403).json({
        error: "You do not have access to this project",
      });
    }

    if (assignedTo) {
      const developer = await query(
        `
        SELECT id
        FROM users
        WHERE id = $1
          AND role = 'developer'
        `,
        [assignedTo],
      );

      if (developer.rows.length === 0) {
        return res.status(400).json({
          error: "Assigned user must be a developer",
        });
      }
    }

    const result = await transaction(async (client) => {
      const taskResult = await client.query(
        `
        INSERT INTO tasks (
          project_id,
          title,
          description,
          assigned_to,
          status,
          priority,
          due_date,
          overdue
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        RETURNING
          id,
          project_id,
          title,
          description,
          assigned_to,
          status,
          priority,
          due_date,
          overdue,
          created_at,
          updated_at
        `,
        [
          projectId,
          title,
          description || null,
          assignedTo || null,
          status || "todo",
          priority || "medium",
          dueDate || null,
        ],
      );

      const task = taskResult.rows[0];

      await client.query(
        `
        INSERT INTO task_status_history (
          task_id,
          changed_by,
          old_status,
          new_status
        )
        VALUES ($1, $2, $3, $4)
        `,
        [task.id, req.user.id, null, task.status],
      );

      const activity = await logActivity(client, {
        userId: req.user.id,
        projectId,
        action: "create_task",
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          assignedTo: task.assigned_to,
          status: task.status,
          priority: task.priority,
        },
      });
      let notification = null;

      if (task.assigned_to) {
        notification = await createNotification(client, {
          userId: task.assigned_to,
          type: "task_assigned",
          title: "New task assigned",
          message: `You have been assigned "${task.title}"`,
          metadata: {
            taskId: task.id,
            projectId: task.project_id,
          },
        });
      }

      return {
        task,
        activity,
        notification,
      };
    });

    broadcastTaskCreated({
      task: result.task,
      assignedTo: result.task.assigned_to,
    });
    if (result.notification) {
      broadcastNotification(result.notification);
    }

    broadcastActivity({
      activity: result.activity,
      assignedUserIds: [result.task.assigned_to],
    });

    res.status(201).json(result.task);
  } catch (error) {
    console.error("Create task error:", error);

    res.status(500).json({
      error: "Failed to create task",
    });
  }
}

export async function updateTask(req, res) {
  try {
    const { id } = req.params;

    const taskResult = await query(
      `
      SELECT
        t.*,
        p.owner_id
      FROM tasks t
      JOIN projects p
        ON p.id = t.project_id
      WHERE t.id = $1
      `,
      [id],
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const task = taskResult.rows[0];

    if (req.user.role === "developer") {
      if (task.assigned_to !== req.user.id) {
        return res.status(403).json({
          error: "You can only update tasks assigned to you",
        });
      }

      const fields = Object.keys(req.body);

      if (fields.length !== 1 || fields[0] !== "status") {
        return res.status(403).json({
          error: "Developers can only update task status",
        });
      }
    } else if (req.user.role === "project_manager") {
      if (task.owner_id !== req.user.id) {
        return res.status(403).json({
          error: "You do not have access to this task",
        });
      }
    } else if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const { title, description, assignedTo, status, priority, dueDate } =
      req.body;

    if (assignedTo) {
      const developer = await query(
        `
        SELECT id
        FROM users
        WHERE id = $1
          AND role = 'developer'
        `,
        [assignedTo],
      );

      if (developer.rows.length === 0) {
        return res.status(400).json({
          error: "Assigned user must be a developer",
        });
      }
    }

    const newStatus = status ?? task.status;

    const newAssignedTo =
      assignedTo === undefined ? task.assigned_to : assignedTo;

    const result = await transaction(async (client) => {
      const updateResult = await client.query(
        `
        UPDATE tasks
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          assigned_to = $3,
          status = $4,
          priority = COALESCE($5, priority),
          due_date = $6,
          updated_at = now()
        WHERE id = $7
        RETURNING
          id,
          project_id,
          title,
          description,
          assigned_to,
          status,
          priority,
          due_date,
          overdue,
          created_at,
          updated_at
        `,
        [
          title ?? null,
          description ?? null,
          newAssignedTo,
          newStatus,
          priority ?? null,
          dueDate === undefined ? task.due_date : dueDate,
          id,
        ],
      );

      const updatedTask = updateResult.rows[0];

      if (task.status !== updatedTask.status) {
        await client.query(
          `
          INSERT INTO task_status_history (
            task_id,
            changed_by,
            old_status,
            new_status
          )
          VALUES ($1, $2, $3, $4)
          `,
          [id, req.user.id, task.status, updatedTask.status],
        );
      }

      const activity = await logActivity(client, {
        userId: req.user.id,
        projectId: updatedTask.project_id,
        action:
          task.status !== updatedTask.status
            ? "update_task_status"
            : "update_task",
        metadata: {
          taskId: updatedTask.id,
          taskTitle: updatedTask.title,
          oldStatus: task.status,
          newStatus: updatedTask.status,
          oldAssignedTo: task.assigned_to,
          newAssignedTo: updatedTask.assigned_to,
        },
      });

      return {
        task: updatedTask,
        activity,
      };
    });

    broadcastTaskUpdated({
      task: result.task,
      previousAssignedTo: task.assigned_to,
    });

    broadcastActivity({
      activity: result.activity,
      assignedUserIds: [task.assigned_to, result.task.assigned_to],
    });

    res.json(result.task);
  } catch (error) {
    console.error("Update task error:", error);

    res.status(500).json({
      error: "Failed to update task",
    });
  }
}

export async function deleteTask(req, res) {
  try {
    const { id } = req.params;

    const taskResult = await query(
      `
      SELECT
        t.id,
        t.project_id,
        t.assigned_to,
        t.title,
        p.owner_id
      FROM tasks t
      JOIN projects p
        ON p.id = t.project_id
      WHERE t.id = $1
      `,
      [id],
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const task = taskResult.rows[0];

    if (
      req.user.role !== "admin" &&
      (req.user.role !== "project_manager" || task.owner_id !== req.user.id)
    ) {
      return res.status(403).json({
        error: "You do not have permission to delete this task",
      });
    }

    const result = await transaction(async (client) => {
      const activity = await logActivity(client, {
        userId: req.user.id,
        projectId: task.project_id,
        action: "delete_task",
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
        },
      });

      await client.query(`DELETE FROM tasks WHERE id = $1`, [id]);

      return {
        activity,
      };
    });

    broadcastTaskDeleted({
      taskId: task.id,
      projectId: task.project_id,
      assignedTo: task.assigned_to,
    });

    broadcastActivity({
      activity: result.activity,
      assignedUserIds: [task.assigned_to],
    });

    res.json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);

    res.status(500).json({
      error: "Failed to delete task",
    });
  }
}

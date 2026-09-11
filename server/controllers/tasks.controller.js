import { query, transaction } from "../db/index.js";
import { logActivity } from "../services/activity.service.js";
import { emitToProject } from "../websocket/index.js";

const getProject = async (client, projectId) => {
  const result = await client.query(
    `SELECT id, owner_id
     FROM projects
     WHERE id = $1`,
    [projectId],
  );

  if (result.rows.length === 0) {
    throw new Error("Project not found");
  }

  return result.rows[0];
};

const checkProjectAccess = async (client, projectId, userId, role) => {
  const project = await getProject(client, projectId);

  if (role === "admin") {
    return project;
  }

  if (role === "project_manager" && project.owner_id === userId) {
    return project;
  }

  throw new Error("Access denied");
};

export const getTasks = async (req, res) => {
  const { id: projectId } = req.params;
  const { status, search, limit = 100, offset = 0 } = req.query;

  try {
    await checkProjectAccess({ query }, projectId, req.user.id, req.user.role);

    let queryText = `
      SELECT
        t.*,
        creator.name AS created_by_name,
        developer.name AS assigned_to_name,
        developer.email AS assigned_to_email
      FROM tasks t
      LEFT JOIN users creator
        ON t.created_by = creator.id
      LEFT JOIN users developer
        ON t.assigned_to = developer.id
      WHERE t.project_id = $1
    `;

    const params = [projectId];
    let paramCount = 2;

    if (status) {
      queryText += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }

    if (search) {
      queryText += `
        AND (
          t.title ILIKE $${paramCount}
          OR t.description ILIKE $${paramCount + 1}
        )
      `;

      params.push(`%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    queryText += `
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date ASC NULLS LAST
      LIMIT $${paramCount++}
      OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      tasks: result.rows,
    });
  } catch (error) {
    console.error("Get tasks error:", error);

    if (error.message === "Project not found") {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    res.status(500).json({
      error: "Failed to fetch tasks",
    });
  }
};

export const getMyTasks = async (req, res) => {
  const { status, priority, limit = 100, offset = 0 } = req.query;

  try {
    let queryText = `
      SELECT
        t.*,
        p.title AS project_title,
        developer.name AS assigned_to_name
      FROM tasks t
      JOIN projects p
        ON t.project_id = p.id
      LEFT JOIN users developer
        ON t.assigned_to = developer.id
      WHERE t.assigned_to = $1
    `;

    const params = [req.user.id];
    let paramCount = 2;

    if (status) {
      queryText += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }

    if (priority) {
      queryText += ` AND t.priority = $${paramCount++}`;
      params.push(priority);
    }

    queryText += `
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date ASC NULLS LAST
      LIMIT $${paramCount++}
      OFFSET $${paramCount++}
    `;

    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      tasks: result.rows,
    });
  } catch (error) {
    console.error("Get my tasks error:", error);

    res.status(500).json({
      error: "Failed to fetch assigned tasks",
    });
  }
};

export const createTask = async (req, res) => {
  const { id: projectId } = req.params;
  const { title, description, priority = "medium" } = req.body;

  try {
    const task = await transaction(async (client) => {
      await checkProjectAccess(client, projectId, req.user.id, req.user.role);

      const result = await client.query(
        `INSERT INTO tasks (
          project_id,
          title,
          description,
          priority,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [projectId, title, description, priority, req.user.id],
      );

      const newTask = result.rows[0];

      await logActivity(client, {
        userId: req.user.id,
        projectId,
        action: "create_task",
        metadata: {
          taskId: newTask.id,
          title,
        },
      });

      return newTask;
    });

    emitToProject(projectId, "task_created", {
      task,
    });

    res.status(201).json({
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    if (error.message === "Project not found") {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    res.status(500).json({
      error: "Failed to create task",
    });
  }
};

export const updateTask = async (req, res) => {
  const { id: taskId } = req.params;
  const updates = req.body;

  try {
    const result = await transaction(async (client) => {
      const taskResult = await client.query(
        `SELECT *
         FROM tasks
         WHERE id = $1
         FOR UPDATE`,
        [taskId],
      );

      if (taskResult.rows.length === 0) {
        throw new Error("Task not found");
      }

      const currentTask = taskResult.rows[0];

      if (req.user.role === "developer") {
        if (currentTask.assigned_to !== req.user.id) {
          throw new Error("Access denied");
        }

        const allowedFields = ["status"];

        for (const key of Object.keys(updates)) {
          if (!allowedFields.includes(key)) {
            throw new Error("Developers can only update task status");
          }
        }
      } else {
        await checkProjectAccess(
          client,
          currentTask.project_id,
          req.user.id,
          req.user.role,
        );
      }

      const fields = [];
      const values = [];
      const diff = {};
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (
          ["title", "description", "status", "priority"].includes(key) &&
          currentTask[key] !== value
        ) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);

          diff[key] = {
            old: currentTask[key],
            new: value,
          };
        }
      }

      if (updates.status === "in-progress" && !currentTask.started_at) {
        fields.push("started_at = now()");

        diff.started_at = {
          old: null,
          new: "now",
        };
      }

      if (updates.status === "done" && !currentTask.completed_at) {
        fields.push("completed_at = now()");

        diff.completed_at = {
          old: null,
          new: "now",
        };
      }

      if (
        currentTask.status === "done" &&
        updates.status &&
        updates.status !== "done"
      ) {
        fields.push("completed_at = NULL");

        diff.completed_at = {
          old: currentTask.completed_at,
          new: null,
        };
      }

      if (fields.length === 0) {
        return {
          task: currentTask,
          diff: {},
        };
      }

      fields.push("updated_at = now()");

      values.push(taskId);

      const updateResult = await client.query(
        `UPDATE tasks
         SET ${fields.join(", ")}
         WHERE id = $${paramCount}
         RETURNING *`,
        values,
      );

      const updatedTask = updateResult.rows[0];

      if (updates.status && updates.status !== currentTask.status) {
        await client.query(
          `INSERT INTO task_status_history (
            task_id,
            changed_by,
            old_status,
            new_status
          )
          VALUES ($1, $2, $3, $4)`,
          [taskId, req.user.id, currentTask.status, updates.status],
        );
      }

      await logActivity(client, {
        userId: req.user.id,
        projectId: currentTask.project_id,
        action: "update_task",
        metadata: {
          taskId,
          diff,
        },
      });

      return {
        task: updatedTask,
        diff,
      };
    });

    emitToProject(result.task.project_id, "task_updated", {
      task: result.task,
      diff: result.diff,
    });

    res.json({
      task: result.task,
    });
  } catch (error) {
    console.error("Update task error:", error);

    if (error.message === "Task not found") {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    if (
      error.message === "Project not found" ||
      error.message === "Access denied"
    ) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    if (error.message === "Developers can only update task status") {
      return res.status(403).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Failed to update task",
    });
  }
};

export const deleteTask = async (req, res) => {
  const { id: taskId } = req.params;

  try {
    const projectId = await transaction(async (client) => {
      const taskResult = await client.query(
        `SELECT project_id
         FROM tasks
         WHERE id = $1`,
        [taskId],
      );

      if (taskResult.rows.length === 0) {
        throw new Error("Task not found");
      }

      const projectId = taskResult.rows[0].project_id;

      await checkProjectAccess(client, projectId, req.user.id, req.user.role);

      await logActivity(client, {
        userId: req.user.id,
        projectId,
        action: "delete_task",
        metadata: {
          taskId,
        },
      });

      await client.query("DELETE FROM tasks WHERE id = $1", [taskId]);

      return projectId;
    });

    emitToProject(projectId, "task_deleted", {
      taskId,
    });

    res.status(204).send();
  } catch (error) {
    console.error("Delete task error:", error);

    if (error.message === "Task not found") {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    if (error.message === "Project not found") {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    res.status(500).json({
      error: "Failed to delete task",
    });
  }
};

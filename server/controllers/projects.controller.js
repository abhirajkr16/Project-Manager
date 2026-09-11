import { query, transaction } from "../db/index.js";
import { logActivity } from "../services/activity.service.js";
import {
  broadcastActivity,
  broadcastProjectCreated,
  broadcastProjectUpdated,
  broadcastProjectDeleted,
} from "../services/realtime.service.js";

const checkProjectAccess = async (client, projectId, userId, role) => {
  const result = await client.query(
    `SELECT id, owner_id
     FROM projects
     WHERE id = $1`,
    [projectId],
  );

  if (result.rows.length === 0) {
    throw new Error("Project not found");
  }

  const project = result.rows[0];

  if (role === "admin") {
    return project;
  }

  if (role === "project_manager" && project.owner_id === userId) {
    return project;
  }

  throw new Error("Access denied");
};

export const getProjects = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { limit = 50, offset = 0 } = req.query;

  try {
    let queryText = `
      SELECT
        p.*,
        u.name AS owner_name,
        u.email AS owner_email,
        c.name AS client_name,
        c.email AS client_email,
        (
          SELECT COUNT(*)
          FROM tasks
          WHERE project_id = p.id
        ) AS task_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN clients c ON p.client_id = c.id
    `;

    const params = [limit, offset];

    if (role === "admin") {
      queryText += `
        ORDER BY p.updated_at DESC
        LIMIT $1 OFFSET $2
      `;
    } else {
      queryText += `
        WHERE p.owner_id = $3
        ORDER BY p.updated_at DESC
        LIMIT $1 OFFSET $2
      `;

      params.push(userId);
    }

    const result = await query(queryText, params);

    res.json({
      projects: result.rows,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    res.status(500).json({
      error: "Failed to fetch projects",
    });
  }
};

export const getProject = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT
         p.*,
         u.name AS owner_name,
         u.email AS owner_email,
         c.name AS client_name,
         c.email AS client_email
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const project = result.rows[0];

    if (req.user.role !== "admin" && project.owner_id !== req.user.id) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    res.json({
      project,
    });
  } catch (error) {
    console.error("Get project error:", error);

    res.status(500).json({
      error: "Failed to fetch project",
    });
  }
};

export const createProject = async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.id;

  try {
    const result = await transaction(async (client) => {
      const projectResult = await client.query(
        `INSERT INTO projects (
           owner_id,
           title,
           description
         )
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, title, description],
      );

      const project = projectResult.rows[0];

      const activity = await logActivity(client, {
        userId,
        projectId: project.id,
        action: "create_project",
        metadata: {
          title,
        },
      });

      return {
        project,
        activity,
      };
    });

    broadcastProjectCreated(result.project);

    broadcastActivity({
      activity: result.activity,
    });

    res.status(201).json({
      project: result.project,
    });
  } catch (error) {
    console.error("Create project error:", error);

    res.status(500).json({
      error: "Failed to create project",
    });
  }
};

export const updateProject = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const result = await transaction(async (client) => {
      const existingProject = await checkProjectAccess(
        client,
        id,
        userId,
        role,
      );

      const fields = [];
      const values = [];
      let paramCount = 1;

      if (title !== undefined) {
        fields.push(`title = $${paramCount++}`);
        values.push(title);
      }

      if (description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(description);
      }

      fields.push("updated_at = now()");

      values.push(id);

      const projectResult = await client.query(
        `UPDATE projects
         SET ${fields.join(", ")}
         WHERE id = $${paramCount}
         RETURNING *`,
        values,
      );

      const project = projectResult.rows[0];

      const activity = await logActivity(client, {
        userId,
        projectId: id,
        action: "update_project",
        metadata: {
          title,
          description,
        },
      });

      return {
        project,
        activity,
        ownerId: existingProject.owner_id,
      };
    });

    broadcastProjectUpdated(result.project);

    broadcastActivity({
      activity: result.activity,
    });

    res.json({
      project: result.project,
    });
  } catch (error) {
    console.error("Update project error:", error);

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
      error: "Failed to update project",
    });
  }
};

export const deleteProject = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const result = await transaction(async (client) => {
      const project = await checkProjectAccess(client, id, userId, role);

      const activity = await logActivity(client, {
        userId,
        projectId: id,
        action: "delete_project",
        metadata: {
          projectTitle: project.title,
        },
      });

      await client.query("DELETE FROM projects WHERE id = $1", [id]);

      return {
        activity,
        ownerId: project.owner_id,
      };
    });

    broadcastProjectDeleted({
      projectId: id,
      ownerId: result.ownerId,
    });

    broadcastActivity({
      activity: result.activity,
    });

    res.status(204).send();
  } catch (error) {
    console.error("Delete project error:", error);

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
      error: "Failed to delete project",
    });
  }
};

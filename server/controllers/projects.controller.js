import { query, transaction } from "../db/index.js";
import { logActivity } from "../services/activity.service.js";
import {
  broadcastActivity,
  broadcastProjectCreated,
  broadcastProjectUpdated,
  broadcastProjectDeleted,
} from "../services/realtime.service.js";

// Keep the database column as "name" while supporting frontend code
// that expects a project property called "title".
const formatProject = (project) => {
  if (!project) return project;

  return {
    ...project,
    title: project.title ?? project.name,
  };
};

const checkProjectAccess = async (client, projectId, userId, role) => {
  const result = await client.query(
    `SELECT id, name, owner_id
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

// GET /projects
export const getProjects = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 50, 1),
    100,
  );
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

  try {
    let queryText = `
      SELECT
        p.*,
        p.name AS title,
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

    if (role !== "admin") {
      queryText += `
        WHERE p.owner_id = $3
      `;
      params.push(userId);
    }

    queryText += `
      ORDER BY p.updated_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await query(queryText, params);

    res.json({
      projects: result.rows.map(formatProject),
    });
  } catch (error) {
    console.error("Get projects error:", error);

    res.status(500).json({
      error: "Failed to fetch projects",
    });
  }
};

// GET /projects/:id
export const getProject = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT
         p.*,
         p.name AS title,
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

    return res.json({
      project: formatProject(project),
    });
  } catch (error) {
    console.error("Get project error:", error);

    return res.status(500).json({
      error: "Failed to fetch project",
    });
  }
};

// POST /projects
export const createProject = async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.id;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({
      error: "Project title is required",
    });
  }

  const projectName = title.trim();

  try {
    const result = await transaction(async (client) => {
      const projectResult = await client.query(
        `INSERT INTO projects (
           owner_id,
           name,
           description
         )
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, projectName, description ?? null],
      );

      const project = projectResult.rows[0];

      const activity = await logActivity(client, {
        userId,
        projectId: project.id,
        action: "create_project",
        metadata: {
          title: projectName,
        },
      });

      return {
        project,
        activity,
      };
    });

    const formattedProject = formatProject(result.project);

    broadcastProjectCreated(formattedProject);

    broadcastActivity({
      activity: result.activity,
    });

    return res.status(201).json({
      project: formattedProject,
    });
  } catch (error) {
    console.error("Create project error:", error);

    return res.status(500).json({
      error: "Failed to create project",
    });
  }
};

// PUT /projects/:id
export const updateProject = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  const userId = req.user.id;
  const role = req.user.role;

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return res.status(400).json({
      error: "Project title must not be empty",
    });
  }

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
        fields.push(`name = $${paramCount++}`);
        values.push(title.trim());
      }

      if (description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(description);
      }

      // Always update the modification timestamp.
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
          title: title === undefined ? existingProject.name : title.trim(),
          description,
        },
      });

      return {
        project,
        activity,
        ownerId: existingProject.owner_id,
      };
    });

    const formattedProject = formatProject(result.project);

    broadcastProjectUpdated(formattedProject);

    broadcastActivity({
      activity: result.activity,
    });

    return res.json({
      project: formattedProject,
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

    return res.status(500).json({
      error: "Failed to update project",
    });
  }
};

// DELETE /projects/:id
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
          projectTitle: project.name,
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

    return res.status(204).send();
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

    return res.status(500).json({
      error: "Failed to delete project",
    });
  }
};

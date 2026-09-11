import { query, transaction } from '../db/index.js';
import { logActivity } from '../services/activity.service.js';

export const getProjects = async (req, res) => {
  const { owned, limit = 50, offset = 0 } = req.query;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    let queryText;
    let params;

    if (isAdmin && owned !== 'true') {
      // Admin can see all projects
      queryText = `
        SELECT p.*, u.name as owner_name, u.email as owner_email,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        ORDER BY p.updated_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, offset];
    } else {
      // Regular users see only their projects
      queryText = `
        SELECT p.*, u.name as owner_name, u.email as owner_email,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        WHERE p.owner_id = $1
        ORDER BY p.updated_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    }

    const result = await query(queryText, params);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProject = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const result = await query(
      `SELECT p.*, u.name as owner_name, u.email as owner_email
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = result.rows[0];

    // Check permissions
    if (!isAdmin && project.owner_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const createProject = async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.id;

  try {
    const result = await transaction(async (client) => {
      // Create project
      const projectResult = await client.query(
        `INSERT INTO projects (owner_id, title, description) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [userId, title, description]
      );

      const project = projectResult.rows[0];

      // Log activity
      await logActivity(client, {
        userId,
        projectId: project.id,
        action: 'create_project',
        metadata: { title }
      });

      return project;
    });

    res.status(201).json({ project: result });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProject = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const result = await transaction(async (client) => {
      // Check ownership
      const checkResult = await client.query(
        'SELECT owner_id FROM projects WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      const project = checkResult.rows[0];

      if (!isAdmin && project.owner_id !== userId) {
        throw new Error('Access denied');
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(title);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }

      updates.push(`updated_at = now()`);
      values.push(id);

      const updateResult = await client.query(
        `UPDATE projects SET ${updates.join(', ')} 
         WHERE id = $${paramCount} 
         RETURNING *`,
        values
      );

      // Log activity
      await logActivity(client, {
        userId,
        projectId: id,
        action: 'update_project',
        metadata: { title, description }
      });

      return updateResult.rows[0];
    });

    res.json({ project: result });
  } catch (error) {
    console.error('Update project error:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    await transaction(async (client) => {
      // Check ownership
      const checkResult = await client.query(
        'SELECT owner_id FROM projects WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      const project = checkResult.rows[0];

      if (!isAdmin && project.owner_id !== userId) {
        throw new Error('Access denied');
      }

      // Log activity before deletion
      await logActivity(client, {
        userId,
        projectId: id,
        action: 'delete_project',
        metadata: {}
      });

      // Delete project (cascades to tasks and activity_logs)
      await client.query('DELETE FROM projects WHERE id = $1', [id]);
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete project error:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

import { query, transaction } from '../db/index.js';
import { logActivity } from '../services/activity.service.js';
import { emitToProject } from '../websocket/index.js';

const checkProjectAccess = async (client, projectId, userId, isAdmin) => {
  const result = await client.query(
    'SELECT owner_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (result.rows.length === 0) {
    throw new Error('Project not found');
  }

  if (!isAdmin && result.rows[0].owner_id !== userId) {
    throw new Error('Access denied');
  }

  return true;
};

export const getTasks = async (req, res) => {
  const { id: projectId } = req.params;
  const { status, search, limit = 100, offset = 0 } = req.query;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    // Check access
    await checkProjectAccess({ query }, projectId, userId, isAdmin);

    // Build query
    let queryText = `
      SELECT t.*, u.name as created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.project_id = $1
    `;
    const params = [projectId];
    let paramCount = 2;

    if (status) {
      queryText += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }

    if (search) {
      queryText += ` AND (t.title ILIKE $${paramCount++} OR t.description ILIKE $${paramCount++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    queryText += ` ORDER BY 
      CASE t.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

export const createTask = async (req, res) => {
  const { id: projectId } = req.params;
  const { title, description, priority = 'medium' } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const task = await transaction(async (client) => {
      // Check access
      await checkProjectAccess(client, projectId, userId, isAdmin);

      // Create task
      const result = await client.query(
        `INSERT INTO tasks (project_id, title, description, priority, created_by) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [projectId, title, description, priority, userId]
      );

      const newTask = result.rows[0];

      // Get creator name
      const userResult = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [userId]
      );
      newTask.created_by_name = userResult.rows[0]?.name;

      // Log activity
      await logActivity(client, {
        userId,
        projectId,
        action: 'create_task',
        metadata: { taskId: newTask.id, title }
      });

      return newTask;
    });

    // Emit WebSocket event
    emitToProject(projectId, 'task_created', { task });

    res.status(201).json({ task });
  } catch (error) {
    console.error('Create task error:', error);
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
};

export const updateTask = async (req, res) => {
  const { id: taskId } = req.params;
  const updates = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const { task, diff } = await transaction(async (client) => {
      // Get current task with lock
      const currentResult = await client.query(
        'SELECT * FROM tasks WHERE id = $1 FOR UPDATE',
        [taskId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const currentTask = currentResult.rows[0];

      // Check project access
      await checkProjectAccess(client, currentTask.project_id, userId, isAdmin);

      // Build update query
      const fields = [];
      const values = [];
      let paramCount = 1;
      const diff = {};

      for (const [key, value] of Object.entries(updates)) {
        if (['title', 'description', 'status', 'priority'].includes(key)) {
          if (currentTask[key] !== value) {
            fields.push(`${key} = $${paramCount++}`);
            values.push(value);
            diff[key] = { old: currentTask[key], new: value };
          }
        }
      }

      // Handle status transitions
      if (updates.status) {
        // Moving to in-progress: set started_at if not set
        if (updates.status === 'in-progress' && !currentTask.started_at) {
          fields.push(`started_at = now()`);
          diff.started_at = { old: null, new: 'now' };
        }

        // Moving to done: set completed_at if not set
        if (updates.status === 'done' && !currentTask.completed_at) {
          fields.push(`completed_at = now()`);
          diff.completed_at = { old: null, new: 'now' };
        }

        // Moving from done to other status: clear completed_at
        if (currentTask.status === 'done' && updates.status !== 'done') {
          fields.push(`completed_at = NULL`);
          diff.completed_at = { old: currentTask.completed_at, new: null };
        }
      }

      if (fields.length === 0) {
        return { task: currentTask, diff: {} };
      }

      fields.push(`updated_at = now()`);
      values.push(taskId);

      const result = await client.query(
        `UPDATE tasks SET ${fields.join(', ')} 
         WHERE id = $${paramCount} 
         RETURNING *`,
        values
      );

      const updatedTask = result.rows[0];

      // Get creator name
      const userResult = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [updatedTask.created_by]
      );
      updatedTask.created_by_name = userResult.rows[0]?.name;

      // Log activity
      await logActivity(client, {
        userId,
        projectId: currentTask.project_id,
        action: 'update_task',
        metadata: { taskId, diff }
      });

      return { task: updatedTask, diff };
    });

    // Emit WebSocket event
    emitToProject(task.project_id, 'task_updated', { task, diff });

    res.json({ task });
  } catch (error) {
    console.error('Update task error:', error);
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
};

export const deleteTask = async (req, res) => {
  const { id: taskId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const projectId = await transaction(async (client) => {
      // Get task
      const taskResult = await client.query(
        'SELECT project_id FROM tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const projectId = taskResult.rows[0].project_id;

      // Check project access
      await checkProjectAccess(client, projectId, userId, isAdmin);

      // Log activity before deletion
      await logActivity(client, {
        userId,
        projectId,
        action: 'delete_task',
        metadata: { taskId }
      });

      // Delete task
      await client.query('DELETE FROM tasks WHERE id = $1', [taskId]);

      return projectId;
    });

    // Emit WebSocket event
    emitToProject(projectId, 'task_deleted', { taskId });

    res.status(204).send();
  } catch (error) {
    console.error('Delete task error:', error);
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

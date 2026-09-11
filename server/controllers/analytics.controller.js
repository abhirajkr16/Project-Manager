import { computeProjectSummary, computeUserActivity } from '../services/analytics.service.js';
import { query } from '../db/index.js';

export const getProjectSummary = async (req, res) => {
  const { id: projectId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Default to last 30 days
  const toDate = req.query.to || new Date().toISOString().split('T')[0];
  const fromDate = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    // Check project access
    const projectResult = await query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!isAdmin && projectResult.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summary = await computeProjectSummary(projectId, fromDate, toDate);

    res.json(summary);
  } catch (error) {
    console.error('Get project summary error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

export const getUserActivity = async (req, res) => {
  const { id: targetUserId } = req.params;
  const requestUserId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Users can only see their own activity unless they're admin
  if (!isAdmin && targetUserId !== requestUserId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Default to last 30 days
  const toDate = req.query.to || new Date().toISOString().split('T')[0];
  const fromDate = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const activity = await computeUserActivity(targetUserId, fromDate, toDate);

    res.json(activity);
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
};

export const getProjectSnapshot = async (req, res) => {
  const { id: projectId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    // Check project access
    const projectResult = await query(
      `SELECT p.*, u.name as owner_name
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    if (!isAdmin && project.owner_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all tasks
    const tasksResult = await query(
      `SELECT t.*, u.name as created_by_name
       FROM tasks t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [projectId]
    );

    // Get recent activity
    const activityResult = await query(
      `SELECT al.*, u.name as user_name
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.project_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [projectId]
    );

    res.json({
      project,
      tasks: tasksResult.rows,
      recentActivity: activityResult.rows
    });
  } catch (error) {
    console.error('Get project snapshot error:', error);
    res.status(500).json({ error: 'Failed to fetch project snapshot' });
  }
};

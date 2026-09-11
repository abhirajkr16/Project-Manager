import { query } from '../db/index.js';

// Fill missing dates with zero counts
const fillDateGaps = (data, fromDate, toDate) => {
  const result = [];
  const dataMap = new Map(data.map(item => [item.date, item.count]));
  
  const current = new Date(fromDate);
  const end = new Date(toDate);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: dataMap.get(dateStr) || 0
    });
    current.setDate(current.getDate() + 1);
  }
  
  return result;
};

export const computeProjectSummary = async (projectId, fromDate, toDate) => {
  try {
    // 1. Task counts by status
    const statusResult = await query(
      `SELECT status, COUNT(*) as count
       FROM tasks
       WHERE project_id = $1
       GROUP BY status`,
      [projectId]
    );

    const taskCountsByStatus = {
      todo: 0,
      'in-progress': 0,
      done: 0
    };

    statusResult.rows.forEach(row => {
      taskCountsByStatus[row.status] = parseInt(row.count);
    });

    // 2. Tasks completed per day
    const completedResult = await query(
      `SELECT to_char(date_trunc('day', completed_at), 'YYYY-MM-DD') AS date,
              COUNT(*) AS count
       FROM tasks
       WHERE project_id = $1 
         AND completed_at IS NOT NULL
         AND completed_at BETWEEN $2 AND $3
       GROUP BY date_trunc('day', completed_at)
       ORDER BY date`,
      [projectId, fromDate, toDate]
    );

    const tasksCompletedPerDay = fillDateGaps(
      completedResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      })),
      fromDate,
      toDate
    );

    // 3. Average completion time in hours
    const avgTimeResult = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_seconds
       FROM tasks
       WHERE project_id = $1 
         AND completed_at IS NOT NULL 
         AND started_at IS NOT NULL`,
      [projectId]
    );

    const avgCompletionTimeHours = avgTimeResult.rows[0].avg_seconds
      ? parseFloat((avgTimeResult.rows[0].avg_seconds / 3600).toFixed(2))
      : 0;

    // 4. Active users
    const activeUsersResult = await query(
      `SELECT al.user_id, u.name, COUNT(*) AS actions_count
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.project_id = $1 
         AND al.created_at BETWEEN $2 AND $3
       GROUP BY al.user_id, u.name
       ORDER BY actions_count DESC
       LIMIT 20`,
      [projectId, fromDate, toDate]
    );

    const activeUsers = activeUsersResult.rows.map(row => ({
      user_id: row.user_id,
      name: row.name,
      actions_count: parseInt(row.actions_count)
    }));

    // 5. Priority distribution
    const priorityResult = await query(
      `SELECT priority, COUNT(*) as count
       FROM tasks
       WHERE project_id = $1
       GROUP BY priority`,
      [projectId]
    );

    const taskCountsByPriority = {
      low: 0,
      medium: 0,
      high: 0
    };

    priorityResult.rows.forEach(row => {
      taskCountsByPriority[row.priority] = parseInt(row.count);
    });

    // 6. Recent activity
    const recentActivityResult = await query(
      `SELECT al.*, u.name as user_name
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.project_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [projectId]
    );

    return {
      taskCountsByStatus,
      tasksCompletedPerDay,
      avgCompletionTimeHours,
      activeUsers,
      taskCountsByPriority,
      recentActivity: recentActivityResult.rows
    };
  } catch (error) {
    console.error('Compute project summary error:', error);
    throw error;
  }
};

export const computeUserActivity = async (userId, fromDate, toDate) => {
  try {
    // Total actions
    const totalResult = await query(
      `SELECT COUNT(*) as count
       FROM activity_logs
       WHERE user_id = $1 
         AND created_at BETWEEN $2 AND $3`,
      [userId, fromDate, toDate]
    );

    const totalActions = parseInt(totalResult.rows[0].count);

    // Actions by type
    const actionTypesResult = await query(
      `SELECT action, COUNT(*) as count
       FROM activity_logs
       WHERE user_id = $1 
         AND created_at BETWEEN $2 AND $3
       GROUP BY action
       ORDER BY count DESC`,
      [userId, fromDate, toDate]
    );

    const actionsByType = actionTypesResult.rows.map(row => ({
      action: row.action,
      count: parseInt(row.count)
    }));

    // Actions per day
    const actionsPerDayResult = await query(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
              COUNT(*) AS count
       FROM activity_logs
       WHERE user_id = $1 
         AND created_at BETWEEN $2 AND $3
       GROUP BY date_trunc('day', created_at)
       ORDER BY date`,
      [userId, fromDate, toDate]
    );

    const actionsPerDay = fillDateGaps(
      actionsPerDayResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      })),
      fromDate,
      toDate
    );

    // Projects contributed to
    const projectsResult = await query(
      `SELECT DISTINCT p.id, p.title, COUNT(al.id) as actions_count
       FROM activity_logs al
       JOIN projects p ON al.project_id = p.id
       WHERE al.user_id = $1 
         AND al.created_at BETWEEN $2 AND $3
       GROUP BY p.id, p.title
       ORDER BY actions_count DESC`,
      [userId, fromDate, toDate]
    );

    const projectsContributed = projectsResult.rows.map(row => ({
      project_id: row.id,
      title: row.title,
      actions_count: parseInt(row.actions_count)
    }));

    // Tasks created
    const tasksCreatedResult = await query(
      `SELECT COUNT(*) as count
       FROM tasks
       WHERE created_by = $1 
         AND created_at BETWEEN $2 AND $3`,
      [userId, fromDate, toDate]
    );

    const tasksCreated = parseInt(tasksCreatedResult.rows[0].count);

    // Tasks completed
    const tasksCompletedResult = await query(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN activity_logs al ON al.metadata->>'taskId' = t.id::text
       WHERE al.user_id = $1 
         AND al.action = 'update_task'
         AND al.metadata->'diff'->'status'->>'new' = 'done'
         AND al.created_at BETWEEN $2 AND $3`,
      [userId, fromDate, toDate]
    );

    const tasksCompleted = parseInt(tasksCompletedResult.rows[0].count);

    return {
      totalActions,
      actionsByType,
      actionsPerDay,
      projectsContributed,
      tasksCreated,
      tasksCompleted
    };
  } catch (error) {
    console.error('Compute user activity error:', error);
    throw error;
  }
};

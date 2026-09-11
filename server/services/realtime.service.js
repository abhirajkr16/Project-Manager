import {
  emitToProject,
  emitToUser,
  emitToRole,
  emitToProjectAndRole,
} from "../websocket/index.js";

export const broadcastActivity = ({ activity, assignedUserIds = [] }) => {
  if (!activity) {
    return;
  }

  const payload = {
    activity,
  };

  if (activity.project_id) {
    emitToProjectAndRole(
      activity.project_id,
      "admin",
      "activity_logged",
      payload,
    );
  } else {
    emitToRole("admin", "activity_logged", payload);
  }

  for (const userId of assignedUserIds) {
    if (userId) {
      emitToUser(userId, "activity_logged", payload);
    }
  }
};
export const broadcastNotification = (notification) => {
  if (!notification) {
    return;
  }

  emitToUser(notification.user_id, "notification_created", {
    notification,
  });
};
export const broadcastTaskCreated = ({ task, assignedTo }) => {
  const payload = {
    task,
  };

  emitToProjectAndRole(task.project_id, "admin", "task_created", payload);

  if (assignedTo) {
    emitToUser(assignedTo, "task_created", payload);
  }
};

export const broadcastTaskUpdated = ({ task, previousAssignedTo }) => {
  const payload = {
    task,
  };

  emitToProjectAndRole(task.project_id, "admin", "task_updated", payload);

  if (previousAssignedTo) {
    emitToUser(previousAssignedTo, "task_updated", payload);
  }

  if (task.assigned_to && task.assigned_to !== previousAssignedTo) {
    emitToUser(task.assigned_to, "task_updated", payload);
  }
};

export const broadcastTaskDeleted = ({ taskId, projectId, assignedTo }) => {
  const payload = {
    taskId,
    projectId,
  };

  emitToProjectAndRole(projectId, "admin", "task_deleted", payload);

  if (assignedTo) {
    emitToUser(assignedTo, "task_deleted", payload);
  }
};

export const broadcastProjectCreated = (project) => {
  const payload = {
    project,
  };

  emitToRole("admin", "project_created", payload);

  emitToUser(project.owner_id, "project_created", payload);
};

export const broadcastProjectUpdated = (project) => {
  const payload = {
    project,
  };

  emitToProject(project.id, "project_updated", payload);

  emitToRole("admin", "project_updated", payload);

  emitToUser(project.owner_id, "project_updated", payload);
};

export const broadcastProjectDeleted = ({ projectId, ownerId }) => {
  const payload = {
    projectId,
  };

  emitToRole("admin", "project_deleted", payload);

  if (ownerId) {
    emitToUser(ownerId, "project_deleted", payload);
  }
};

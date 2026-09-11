import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Check,
  Filter,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  projectsApi,
  tasksApi,
  analyticsApi,
} from "@/lib/api";

import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/contexts/WebSocketContext";

import type {
  Task,
  TaskPriority,
  TaskStatus,
  TasksByStatus,
} from "@/types";

const COLORS = [
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

const STATUS_OPTIONS: Array<{
  value: TaskStatus;
  label: string;
}> = [
  {
    value: "todo",
    label: "To Do",
  },
  {
    value: "in-progress",
    label: "In Progress",
  },
  {
    value: "in-review",
    label: "In Review",
  },
  {
    value: "done",
    label: "Done",
  },
];

const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
}> = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "critical",
    label: "Critical",
  },
];

interface TaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assignedTo: string;
}

interface TaskFilters {
  status: TaskStatus | "";
  priority: TaskPriority | "";
  dueFrom: string;
  dueTo: string;
  search: string;
}

const emptyTaskForm: TaskForm = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  dueDate: "",
  assignedTo: "",
};

const emptyFilters: TaskFilters = {
  status: "",
  priority: "",
  dueFrom: "",
  dueTo: "",
  search: "",
};

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const {
    joinProject,
    leaveProject,
  } = useWebSocket();

  const [showAnalytics, setShowAnalytics] =
    useState(false);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [editingTask, setEditingTask] =
    useState<Task | null>(null);

  const [draggedTaskId, setDraggedTaskId] =
    useState<string | null>(null);

  const [taskForm, setTaskForm] =
    useState<TaskForm>(emptyTaskForm);

  const [filters, setFilters] =
    useState<TaskFilters>(emptyFilters);

  const canManageTasks =
    user?.role === "admin" ||
    user?.role === "project_manager";

  const isDeveloper =
    user?.role === "developer";

  const {
    data: project,
    isLoading: projectLoading,
  } = useQuery({
    queryKey: ["project", id],
    queryFn: () =>
      projectsApi.getProject(id!),
    enabled:
      Boolean(id) &&
      canManageTasks,
  });

  const {
    data: tasks = [],
    isLoading: tasksLoading,
  } = useQuery({
    queryKey: [
      "tasks",
      id,
      filters,
    ],
    queryFn: () =>
      tasksApi.getTasks(id!, {
        status:
          filters.status || undefined,

        priority:
          filters.priority || undefined,

        dueFrom:
          filters.dueFrom || undefined,

        dueTo:
          filters.dueTo || undefined,

        search:
          filters.search.trim() ||
          undefined,

        limit: 50,
        offset: 0,
      }),
    enabled:
      Boolean(id) &&
      canManageTasks,
  });

  const {
    data: myTasks = [],
    isLoading: myTasksLoading,
  } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: tasksApi.getMyTasks,
    enabled: Boolean(isDeveloper),
  });

  const visibleTasks = useMemo(
    () =>
      canManageTasks
        ? tasks
        : myTasks.filter(
            (task) =>
              task.project_id === id,
          ),
    [
      canManageTasks,
      id,
      myTasks,
      tasks,
    ],
  );

  const developerProject =
    useMemo(() => {
      if (
        !isDeveloper ||
        !id
      ) {
        return null;
      }

      const projectTask =
        myTasks.find(
          (task) =>
            task.project_id === id,
        );

      if (!projectTask) {
        return null;
      }

      return {
        title:
          projectTask.project_title ||
          "Project",
        description: null,
      };
    }, [id, isDeveloper, myTasks]);

  const projectDetails =
    project || developerProject;

  const { data: analytics } =
    useQuery({
      queryKey: ["analytics", id],
      queryFn: () =>
        analyticsApi.getProjectSummary(
          id!,
        ),
      enabled:
        Boolean(id) &&
        showAnalytics &&
        canManageTasks,
    });

  useEffect(() => {
    if (!id) {
      return;
    }

    if (canManageTasks) {
      joinProject(id);
    }

    return () => {
      if (canManageTasks) {
        leaveProject(id);
      }
    };
  }, [
    canManageTasks,
    id,
    joinProject,
    leaveProject,
  ]);

  useEffect(() => {
    const invalidateTasks = () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", id],
      });

      queryClient.invalidateQueries({
        queryKey: ["my-tasks"],
      });

      queryClient.invalidateQueries({
        queryKey: ["analytics", id],
      });
    };

    window.addEventListener(
      "task_updated",
      invalidateTasks,
    );

    window.addEventListener(
      "task_created",
      invalidateTasks,
    );

    window.addEventListener(
      "task_deleted",
      invalidateTasks,
    );

    return () => {
      window.removeEventListener(
        "task_updated",
        invalidateTasks,
      );

      window.removeEventListener(
        "task_created",
        invalidateTasks,
      );

      window.removeEventListener(
        "task_deleted",
        invalidateTasks,
      );
    };
  }, [id, queryClient]);

  const createTaskMutation =
    useMutation({
      mutationFn: (data: TaskForm) =>
        tasksApi.createTask(id!, {
          title: data.title.trim(),

          description:
            data.description.trim() ||
            null,

          assignedTo:
            data.assignedTo || null,

          status: data.status,

          priority: data.priority,

          dueDate: data.dueDate
            ? new Date(
                `${data.dueDate}T23:59:59`,
              ).toISOString()
            : null,
        }),

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["tasks", id],
        });

        queryClient.invalidateQueries({
          queryKey: ["my-tasks"],
        });

        queryClient.invalidateQueries({
          queryKey: ["analytics", id],
        });

        setTaskForm(emptyTaskForm);
        setShowCreateForm(false);
      },
    });

  const updateTaskMutation =
    useMutation({
      mutationFn: ({
        taskId,
        data,
      }: {
        taskId: string;

        data: {
          title?: string;
          description?: string | null;
          assignedTo?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          dueDate?: string | null;
        };
      }) =>
        tasksApi.updateTask(
          taskId,
          data,
        ),

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["tasks", id],
        });

        queryClient.invalidateQueries({
          queryKey: ["my-tasks"],
        });

        queryClient.invalidateQueries({
          queryKey: ["analytics", id],
        });

        setEditingTask(null);
        setTaskForm(emptyTaskForm);
      },
    });

  const deleteTaskMutation =
    useMutation({
      mutationFn: tasksApi.deleteTask,

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["tasks", id],
        });

        queryClient.invalidateQueries({
          queryKey: ["analytics", id],
        });
      },
    });

  const tasksByStatus: TasksByStatus =
    useMemo(
      () => ({
        todo: visibleTasks.filter(
          (task) =>
            task.status === "todo",
        ),

        "in-progress":
          visibleTasks.filter(
            (task) =>
              task.status ===
              "in-progress",
          ),

        "in-review":
          visibleTasks.filter(
            (task) =>
              task.status ===
              "in-review",
          ),

        done: visibleTasks.filter(
          (task) =>
            task.status === "done",
        ),
      }),
      [visibleTasks],
    );

  const hasActiveFilters =
    Boolean(
      filters.status ||
        filters.priority ||
        filters.dueFrom ||
        filters.dueTo ||
        filters.search,
    );

  const resetForm = () => {
    setTaskForm(emptyTaskForm);
    setEditingTask(null);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
  };

  const openEditForm = (
    task: Task,
  ) => {
    setEditingTask(task);

    setTaskForm({
      title: task.title,

      description:
        task.description || "",

      priority: task.priority,

      status: task.status,

      dueDate: task.due_date
        ? new Date(
            task.due_date,
          )
            .toISOString()
            .slice(0, 10)
        : "",

      assignedTo:
        task.assigned_to || "",
    });

    setShowCreateForm(true);
  };

  const handleSubmitTask = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!taskForm.title.trim()) {
      return;
    }

    if (editingTask) {
      updateTaskMutation.mutate({
        taskId: editingTask.id,

        data: {
          title:
            taskForm.title.trim(),

          description:
            taskForm.description.trim() ||
            null,

          assignedTo:
            taskForm.assignedTo ||
            null,

          status: taskForm.status,

          priority:
            taskForm.priority,

          dueDate: taskForm.dueDate
            ? new Date(
                `${taskForm.dueDate}T23:59:59`,
              ).toISOString()
            : null,
        },
      });

      return;
    }

    createTaskMutation.mutate(
      taskForm,
    );
  };

  const handleStatusChange = (
    task: Task,
    newStatus: TaskStatus,
  ) => {
    if (
      task.status === newStatus
    ) {
      return;
    }

    updateTaskMutation.mutate({
      taskId: task.id,

      data: {
        status: newStatus,
      },
    });
  };

  const handleDeleteTask = (
    task: Task,
  ) => {
    if (
      !confirm(
        `Delete "${task.title}"?`,
      )
    ) {
      return;
    }

    deleteTaskMutation.mutate(
      task.id,
    );
  };

  const handleDragStart = (
    event: React.DragEvent,
    taskId: string,
  ) => {
    if (isDeveloper) {
      return;
    }

    setDraggedTaskId(taskId);

    event.dataTransfer.effectAllowed =
      "move";
  };

  const handleDragOver = (
    event: React.DragEvent,
  ) => {
    if (isDeveloper) {
      return;
    }

    event.preventDefault();

    event.dataTransfer.dropEffect =
      "move";
  };

  const handleDrop = (
    event: React.DragEvent,
    status: TaskStatus,
  ) => {
    event.preventDefault();

    if (
      isDeveloper ||
      !draggedTaskId
    ) {
      return;
    }

    const task =
      visibleTasks.find(
        (item) =>
          item.id ===
          draggedTaskId,
      );

    if (task) {
      handleStatusChange(
        task,
        status,
      );
    }

    setDraggedTaskId(null);
  };

  const getPriorityClass = (
    priority: TaskPriority,
  ) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";

      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";

      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";

      case "low":
        return "bg-green-100 text-green-800 border-green-200";

      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatDueDate = (
    date: string | null,
  ) => {
    if (!date) {
      return "No due date";
    }

    return new Date(
      date,
    ).toLocaleDateString();
  };

  const renderTaskCard = (
    task: Task,
  ) => {
    const canEdit =
      canManageTasks ||
      (isDeveloper &&
        task.assigned_to ===
          user?.id);

    return (
      <div
        key={task.id}
        draggable={
          canManageTasks
        }
        onDragStart={(event) =>
          handleDragStart(
            event,
            task.id,
          )
        }
        onDragEnd={() =>
          setDraggedTaskId(null)
        }
        className={`rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
          draggedTaskId === task.id
            ? "opacity-50"
            : ""
        }`}
      >
        <div className="flex items-start gap-2">
          {canManageTasks && (
            <GripVertical className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-gray-900">
                {task.title}
              </h4>

              {canManageTasks && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      openEditForm(
                        task,
                      )
                    }
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    title="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteTask(
                        task,
                      )
                    }
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {task.description && (
              <p className="mt-2 text-sm text-gray-600">
                {task.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded border px-2 py-1 text-xs font-medium ${getPriorityClass(
                  task.priority,
                )}`}
              >
                {task.priority}
              </span>

              {task.overdue && (
                <span className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                  Overdue
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />

                <span>
                  Due:{" "}
                  {formatDueDate(
                    task.due_date,
                  )}
                </span>
              </div>

              {task.assigned_developer && (
                <div>
                  Assigned to:{" "}
                  <span className="font-medium text-gray-700">
                    {
                      task.assigned_developer
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <select
                value={task.status}
                onChange={(event) =>
                  handleStatusChange(
                    task,
                    event.target
                      .value as TaskStatus,
                  )
                }
                disabled={
                  !canEdit ||
                  updateTaskMutation.isPending
                }
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderKanbanColumn = (
    status: TaskStatus,
    title: string,
  ) => {
    const columnTasks =
      tasksByStatus[status];

    return (
      <div
        key={status}
        className="min-w-[280px] flex-1 rounded-lg bg-gray-50 p-4"
        onDragOver={
          handleDragOver
        }
        onDrop={(event) =>
          handleDrop(
            event,
            status,
          )
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {title}
          </h3>

          <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
            {columnTasks.length}
          </span>
        </div>

        <div className="min-h-[350px] space-y-3">
          {columnTasks.length ===
          0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              No tasks
            </div>
          ) : (
            columnTasks.map(
              renderTaskCard,
            )
          )}
        </div>
      </div>
    );
  };

  if (
    (canManageTasks &&
      projectLoading) ||
    (isDeveloper &&
      myTasksLoading)
  ) {
    return (
      <div className="py-12 text-center text-gray-500">
        Loading project...
      </div>
    );
  }

  if (!projectDetails) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">
          Project not found.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/")
          }
          className="mt-4 text-primary-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() =>
              navigate("/")
            }
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {projectDetails.title}
            </h1>

            {projectDetails.description && (
              <p className="mt-1 text-sm text-gray-600">
                {projectDetails.description}
              </p>
            )}
          </div>
        </div>

        {canManageTasks && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreateForm(
                  true,
                );
              }}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>

            <button
              type="button"
              onClick={() =>
                setShowAnalytics(
                  !showAnalytics,
                )
              }
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                showAnalytics
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <BarChart3 className="h-4 w-4" />

              {showAnalytics
                ? "Hide Analytics"
                : "Analytics"}
            </button>
          </div>
        )}
      </div>

      {canManageTasks &&
        showCreateForm && (
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTask
                  ? "Edit Task"
                  : "Create New Task"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(
                    false,
                  );
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmitTask
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Task title
                </label>

                <input
                  type="text"
                  value={
                    taskForm.title
                  }
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Enter task title"
                  maxLength={200}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  value={
                    taskForm.description
                  }
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      description:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Describe the task"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Priority
                  </label>

                  <select
                    value={
                      taskForm.priority
                    }
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        priority:
                          event.target
                            .value as TaskPriority,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    {PRIORITY_OPTIONS.map(
                      (option) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Status
                  </label>

                  <select
                    value={
                      taskForm.status
                    }
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        status:
                          event.target
                            .value as TaskStatus,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    {STATUS_OPTIONS.map(
                      (option) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Due date
                  </label>

                  <input
                    type="date"
                    value={
                      taskForm.dueDate
                    }
                    onChange={(event) =>
                      setTaskForm({
                        ...taskForm,
                        dueDate:
                          event.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Developer ID
                </label>

                <input
                  type="text"
                  value={
                    taskForm.assignedTo
                  }
                  onChange={(event) =>
                    setTaskForm({
                      ...taskForm,
                      assignedTo:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Developer user ID"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Use the developer's
                  user ID.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowCreateForm(
                      false,
                    );
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createTaskMutation.isPending ||
                    updateTaskMutation.isPending
                  }
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />

                  {createTaskMutation.isPending ||
                  updateTaskMutation.isPending
                    ? "Saving..."
                    : editingTask
                      ? "Save Changes"
                      : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        )}

      {canManageTasks &&
        showAnalytics &&
        analytics && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">
                Tasks Completed Over Time
              </h3>

              <ResponsiveContainer
                width="100%"
                height={250}
              >
                <LineChart
                  data={
                    analytics.tasksCompletedPerDay
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">
                Task Distribution
              </h3>

              <ResponsiveContainer
                width="100%"
                height={250}
              >
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "To Do",
                        value:
                          analytics
                            .taskCountsByStatus
                            .todo,
                      },
                      {
                        name: "In Progress",
                        value:
                          analytics
                            .taskCountsByStatus[
                            "in-progress"
                          ],
                      },
                      {
                        name: "In Review",
                        value:
                          analytics
                            .taskCountsByStatus[
                            "in-review"
                          ],
                      },
                      {
                        name: "Done",
                        value:
                          analytics
                            .taskCountsByStatus
                            .done,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) =>
                      `${entry.name}: ${entry.value}`
                    }
                    outerRadius={80}
                    dataKey="value"
                  >
                    {[0, 1, 2, 3].map(
                      (index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            COLORS[index]
                          }
                        />
                      ),
                    )}
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">
                Active Users
              </h3>

              <ResponsiveContainer
                width="100%"
                height={250}
              >
                <BarChart
                  data={analytics.activeUsers.slice(
                    0,
                    5,
                  )}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />

                  <Bar
                    dataKey="actions_count"
                    fill="#10b981"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">
                Key Metrics
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between rounded bg-gray-50 p-3">
                  <span className="text-gray-600">
                    Avg Completion Time
                  </span>

                  <span className="font-semibold">
                    {analytics.avgCompletionTimeHours.toFixed(
                      1,
                    )}{" "}
                    hours
                  </span>
                </div>

                <div className="flex justify-between rounded bg-gray-50 p-3">
                  <span className="text-gray-600">
                    Total Tasks
                  </span>

                  <span className="font-semibold">
                    {
                      visibleTasks.length
                    }
                  </span>
                </div>

                <div className="flex justify-between rounded bg-gray-50 p-3">
                  <span className="text-gray-600">
                    Completed
                  </span>

                  <span className="font-semibold text-green-600">
                    {
                      analytics
                        .taskCountsByStatus
                        .done
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      {canManageTasks && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />

            <h3 className="text-sm font-semibold text-gray-900">
              Filter Tasks
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Search
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="text"
                  value={
                    filters.search
                  }
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      search:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Search tasks..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Status
              </label>

              <select
                value={
                  filters.status
                }
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    status:
                      event.target
                        .value as TaskStatus | "",
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Priority
              </label>

              <select
                value={
                  filters.priority
                }
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    priority:
                      event.target
                        .value as TaskPriority | "",
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">
                  All priorities
                </option>

                {PRIORITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Due from
              </label>

              <input
                type="date"
                value={
                  filters.dueFrom
                }
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    dueFrom:
                      event.target
                        .value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Due to
              </label>

              <input
                type="date"
                value={
                  filters.dueTo
                }
                min={
                  filters.dueFrom ||
                  undefined
                }
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    dueTo:
                      event.target
                        .value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                Showing filtered
                results from the
                server.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />

                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isDeveloper
                ? "My Tasks"
                : "Project Tasks"}
            </h2>

            {isDeveloper && (
              <p className="mt-1 text-sm text-gray-500">
                You can update the
                status of your
                assigned tasks.
              </p>
            )}
          </div>

          <span className="text-sm text-gray-500">
            {visibleTasks.length}{" "}
            {visibleTasks.length ===
            1
              ? "task"
              : "tasks"}
          </span>
        </div>

        {tasksLoading &&
        canManageTasks ? (
          <div className="py-8 text-center text-gray-500">
            Loading tasks...
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {renderKanbanColumn(
              "todo",
              "To Do",
            )}

            {renderKanbanColumn(
              "in-progress",
              "In Progress",
            )}

            {renderKanbanColumn(
              "in-review",
              "In Review",
            )}

            {renderKanbanColumn(
              "done",
              "Done",
            )}
          </div>
        )}
      </div>
    </div>
  );
}

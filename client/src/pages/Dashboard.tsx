import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Folder,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { projectsApi, tasksApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Project,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/types";

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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);

  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
  });

  const isDeveloper =
    user?.role === "developer";

  const canManageProjects =
    user?.role === "admin" ||
    user?.role === "project_manager";

  const {
    data: projects = [],
    isLoading: projectsLoading,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getProjects(),
    enabled: canManageProjects,
  });

  const {
    data: myTasks = [],
    isLoading: tasksLoading,
  } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: tasksApi.getMyTasks,
    enabled: isDeveloper,
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.createProject,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });

      setIsCreating(false);

      setNewProject({
        title: "",
        description: "",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.deleteProject,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: TaskStatus;
    }) =>
      tasksApi.updateTask(taskId, {
        status,
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["my-tasks"],
      });
    },
  });

  const developerProjects = useMemo(() => {
    const projectMap = new Map<
      string,
      {
        id: string;
        title: string;
        tasks: Task[];
      }
    >();

    myTasks.forEach((task) => {
      const projectTitle =
        task.project_title || "Project";

      const existing =
        projectMap.get(task.project_id);

      if (existing) {
        existing.tasks.push(task);
        return;
      }

      projectMap.set(task.project_id, {
        id: task.project_id,
        title: projectTitle,
        tasks: [task],
      });
    });

    return Array.from(projectMap.values());
  }, [myTasks]);

  const handleCreate = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!newProject.title.trim()) {
      return;
    }

    createMutation.mutate({
      title: newProject.title.trim(),
      description:
        newProject.description.trim(),
    });
  };

  const getPriorityClass = (
    priority: TaskPriority,
  ) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-700 border-red-200";

      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";

      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";

      case "low":
        return "bg-green-100 text-green-700 border-green-200";

      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusClass = (
    status: TaskStatus,
  ) => {
    switch (status) {
      case "todo":
        return "bg-gray-100 text-gray-700";

      case "in-progress":
        return "bg-blue-100 text-blue-700";

      case "in-review":
        return "bg-purple-100 text-purple-700";

      case "done":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (
    date: string | null,
  ) => {
    if (!date) {
      return "No due date";
    }

    return new Date(date).toLocaleDateString();
  };

  const renderDeveloperDashboard = () => {
    if (tasksLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            My Tasks
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Tasks and projects assigned to you
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5">
                <ListTodo className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Total Tasks
                </p>

                <p className="text-2xl font-bold text-gray-900">
                  {myTasks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2.5">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  In Progress
                </p>

                <p className="text-2xl font-bold text-gray-900">
                  {
                    myTasks.filter(
                      (task) =>
                        task.status ===
                        "in-progress",
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2.5">
                <Pencil className="h-5 w-5 text-purple-600" />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  In Review
                </p>

                <p className="text-2xl font-bold text-gray-900">
                  {
                    myTasks.filter(
                      (task) =>
                        task.status ===
                        "in-review",
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Completed
                </p>

                <p className="text-2xl font-bold text-gray-900">
                  {
                    myTasks.filter(
                      (task) =>
                        task.status === "done",
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              My Projects
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Projects containing tasks assigned to you
            </p>
          </div>

          {developerProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <Folder className="mx-auto h-10 w-10 text-gray-300" />

              <h3 className="mt-3 font-medium text-gray-900">
                No projects yet
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Projects will appear here when tasks are
                assigned to you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {developerProjects.map(
                (project) => {
                  const totalTasks =
                    project.tasks.length;

                  const completedTasks =
                    project.tasks.filter(
                      (task) =>
                        task.status === "done",
                    ).length;

                  const inProgressTasks =
                    project.tasks.filter(
                      (task) =>
                        task.status ===
                        "in-progress",
                    ).length;

                  const inReviewTasks =
                    project.tasks.filter(
                      (task) =>
                        task.status ===
                        "in-review",
                    ).length;

                  return (
                    <div
                      key={project.id}
                      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 transition-colors group-hover:bg-primary-100">
                            <Folder className="h-6 w-6 text-primary-600" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold text-gray-900">
                              {project.title}
                            </h3>

                            <p className="mt-0.5 text-xs text-gray-500">
                              {totalTasks}{" "}
                              {totalTasks === 1
                                ? "assigned task"
                                : "assigned tasks"}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          My Project
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-lg font-semibold text-gray-900">
                            {
                              project.tasks.filter(
                                (task) =>
                                  task.status ===
                                  "todo",
                              ).length
                            }
                          </p>

                          <p className="text-xs text-gray-500">
                            To Do
                          </p>
                        </div>

                        <div className="rounded-lg bg-blue-50 p-3 text-center">
                          <p className="text-lg font-semibold text-blue-700">
                            {inProgressTasks}
                          </p>

                          <p className="text-xs text-blue-600">
                            Progress
                          </p>
                        </div>

                        <div className="rounded-lg bg-green-50 p-3 text-center">
                          <p className="text-lg font-semibold text-green-700">
                            {completedTasks}
                          </p>

                          <p className="text-xs text-green-600">
                            Done
                          </p>
                        </div>
                      </div>

                      {inReviewTasks > 0 && (
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2">
                          <span className="text-xs font-medium text-purple-700">
                            Tasks in review
                          </span>

                          <span className="text-sm font-semibold text-purple-700">
                            {inReviewTasks}
                          </span>
                        </div>
                      )}

                      <div className="mt-5 border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-500">
                          You can update the status of your
                          assigned tasks from the list below.
                        </p>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>

        <section>
  <div className="mb-4">
    <h2 className="text-xl font-semibold text-gray-900">
      Assigned Tasks
    </h2>

    <p className="mt-1 text-sm text-gray-500">
      Tasks assigned to you, grouped by project
    </p>
  </div>

  {myTasks.length === 0 ? (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300" />

      <h3 className="mt-4 font-medium text-gray-900">
        No tasks assigned
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        You will see tasks here when a project manager
        assigns them to you.
      </p>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {myTasks.map((task: Task) => (
        <div
          key={task.id}
          className="group flex min-h-[290px] flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg"
        >
          <div className="border-b border-gray-100 pb-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <Folder className="h-4 w-4 text-primary-600" />
              </div>

              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Project
              </span>
            </div>

            <p className="truncate text-sm font-semibold text-primary-700">
              {task.project_title || "Project"}
            </p>
          </div>

          <div className="pt-4">
            <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
              {task.title}
            </h3>

            {task.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-gray-600">
                {task.description}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${getPriorityClass(
                task.priority,
              )}`}
            >
              {task.priority}
            </span>

            <span
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${getStatusClass(
                task.status,
              )}`}
            >
              {
                STATUS_OPTIONS.find(
                  (option) =>
                    option.value === task.status,
                )?.label
              }
            </span>

            {task.overdue && (
              <span className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                Overdue
              </span>
            )}
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                Due date
              </span>

              <span
                className={
                  task.overdue
                    ? "font-semibold text-red-600"
                    : "font-medium text-gray-700"
                }
              >
                {formatDate(task.due_date)}
              </span>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3 border-t border-gray-100 pt-4">
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${getStatusClass(
                task.status,
              )}`}
            >
              {
                STATUS_OPTIONS.find(
                  (option) =>
                    option.value === task.status,
                )?.label
              }
            </span>

            <select
              value={task.status}
              disabled={updateTaskMutation.isPending}
              onChange={(event) =>
                updateTaskMutation.mutate({
                  taskId: task.id,
                  status:
                    event.target.value as TaskStatus,
                })
              }
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  )}
</section>
      </div>
    );
  };

  const renderManagerDashboard = () => {
    if (projectsLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Projects
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Manage your development projects
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            New Project
          </button>
        </div>

        {isCreating && (
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="mb-4 text-lg font-semibold">
              Create New Project
            </h3>

            <form
              onSubmit={handleCreate}
              className="space-y-4"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Project Title
                </label>

                <input
                  type="text"
                  value={newProject.title}
                  onChange={(event) =>
                    setNewProject({
                      ...newProject,
                      title: event.target.value,
                    })
                  }
                  placeholder="Enter project title"
                  maxLength={200}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  value={newProject.description}
                  onChange={(event) =>
                    setNewProject({
                      ...newProject,
                      description:
                        event.target.value,
                    })
                  }
                  placeholder="Enter project description"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending
                    ? "Creating..."
                    : "Create Project"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setIsCreating(false)
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(
            (project: Project) => (
              <div
                key={project.id}
                onClick={() =>
                  navigate(
                    `/projects/${project.id}`,
                  )
                }
                className="group cursor-pointer rounded-lg bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-100 p-2 transition-colors group-hover:bg-primary-200">
                      <Folder className="h-6 w-6 text-primary-600" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-gray-900">
                        {project.title}
                      </h3>

                      <p className="text-sm text-gray-500">
                        {project.task_count || 0} tasks
                      </p>
                    </div>
                  </div>

                  {project.description && (
                    <p className="mt-4 line-clamp-2 text-sm text-gray-600">
                      {project.description}
                    </p>
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(
                        project.created_at,
                      ).toLocaleDateString()}
                    </span>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        if (
                          confirm(
                            "Are you sure you want to delete this project?",
                          )
                        ) {
                          deleteMutation.mutate(
                            project.id,
                          );
                        }
                      }}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>

        {projects.length === 0 &&
          !isCreating && (
            <div className="py-16 text-center">
              <Folder className="mx-auto h-12 w-12 text-gray-300" />

              <h3 className="mt-4 font-medium text-gray-900">
                No projects yet
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Create your first project to get
                started.
              </p>
            </div>
          )}
      </div>
    );
  };

  if (isDeveloper) {
    return renderDeveloperDashboard();
  }

  return renderManagerDashboard();
}

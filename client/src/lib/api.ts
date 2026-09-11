import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import type {
  AuthResponse,
  Notification,
  Project,
  Task,
  ProjectSummary,
  UserActivity,
  ActivityLog,
} from "@/types";

const API_URL =
  (import.meta.env.VITE_API_URL as string) ||
  "http://localhost:3001";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    const response = await api.post<AuthResponse>(
      "/auth/register",
      data,
    );

    return response.data;
  },

  login: async (data: {
    email: string;
    password: string;
  }) => {
    const response = await api.post<AuthResponse>(
      "/auth/login",
      data,
    );

    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get("/auth/me");

    return response.data.user;
  },
};

export const notificationsApi = {
  getNotifications: async () => {
    const response = await api.get<{
      notifications: Notification[];
      unreadCount: number;
    }>("/notifications");

    return response.data;
  },

  markRead: async (id: string) => {
    const response = await api.patch<{
      notification: Notification;
    }>(`/notifications/${id}/read`);

    return response.data.notification;
  },

  markAllRead: async () => {
    await api.patch("/notifications/read-all");
  },
};

export const projectsApi = {
  getProjects: async (params?: {
    owned?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get<{ projects: Project[] }>(
      "/projects",
      { params },
    );

    return response.data.projects;
  },

  getProject: async (id: string) => {
    const response = await api.get<{ project: Project }>(
      `/projects/${id}`,
    );

    return response.data.project;
  },

  createProject: async (data: {
    title: string;
    description?: string;
  }) => {
    const response = await api.post<{ project: Project }>(
      "/projects",
      data,
    );

    return response.data.project;
  },

  updateProject: async (
    id: string,
    data: {
      title?: string;
      description?: string;
    },
  ) => {
    const response = await api.put<{ project: Project }>(
      `/projects/${id}`,
      data,
    );

    return response.data.project;
  },

  deleteProject: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },
};

export const tasksApi = {
  getTasks: async (
    projectId: string,
    params?: {
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) => {
    const response = await api.get<Task[]>(
      `/tasks/projects/${projectId}/tasks`,
      { params },
    );

    return response.data;
  },

  createTask: async (
    projectId: string,
    data: {
      title: string;
      description?: string;
      priority?: string;
    },
  ) => {
    const response = await api.post<Task>(
      `/tasks/projects/${projectId}/tasks`,
      data,
    );

    return response.data;
  },

  updateTask: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
    },
  ) => {
    const response = await api.put<Task>(
      `/tasks/${id}`,
      data,
    );

    return response.data;
  },

  deleteTask: async (id: string) => {
    await api.delete(`/tasks/${id}`);
  },
};

export const analyticsApi = {
  getProjectSummary: async (
    projectId: string,
    params?: {
      from?: string;
      to?: string;
    },
  ) => {
    const response = await api.get<ProjectSummary>(
      `/analytics/projects/${projectId}/summary`,
      { params },
    );

    return response.data;
  },

  getUserActivity: async (
    userId: string,
    params?: {
      from?: string;
      to?: string;
    },
  ) => {
    const response = await api.get<UserActivity>(
      `/analytics/users/${userId}/activity`,
      { params },
    );

    return response.data;
  },

  getProjectSnapshot: async (projectId: string) => {
    const response = await api.get(
      `/analytics/projects/${projectId}/snapshot`,
    );

    return response.data;
  },
};

export const activityApi = {
  getMyActivity: async (limit = 20) => {
    const response = await api.get<{
      activities: ActivityLog[];
    }>("/activity", {
      params: { limit },
    });

    return response.data.activities;
  },
};

export default api;
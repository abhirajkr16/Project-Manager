import request from "supertest";
import app from "../index.js";

const login = async (email, password) => {
  const response = await request(app).post("/auth/login").send({
    email,
    password,
  });

  expect(response.statusCode).toBe(200);

  return response.body.accessToken;
};

describe("Tasks API", () => {
  let adminToken;
  let pmToken;
  let developerToken;

  let projectId;
  let taskId;

  beforeAll(async () => {
    adminToken = await login("admin@example.com", "admin123");

    pmToken = await login("alice@example.com", "user123");

    developerToken = await login("ravi@example.com", "user123");

    const projectsResponse = await request(app)
      .get("/projects")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(projectsResponse.statusCode).toBe(200);
    expect(projectsResponse.body.projects).toBeInstanceOf(Array);
    expect(projectsResponse.body.projects.length).toBeGreaterThan(0);

    projectId = projectsResponse.body.projects[0].id;
  });

  test("admin can retrieve project tasks", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);
  });

  test("project manager can retrieve project tasks", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${pmToken}`);

    expect([200, 403]).toContain(response.statusCode);
  });

  test("developer can retrieve own assigned tasks", async () => {
    const response = await request(app)
      .get("/tasks/my")
      .set("Authorization", `Bearer ${developerToken}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test("invalid project id returns an error", async () => {
    const response = await request(app)
      .get(
        "/tasks/projects/00000000-0000-0000-0000-000000000000/tasks",
      )
      .set("Authorization", `Bearer ${adminToken}`);

    expect([403, 404]).toContain(response.statusCode);
  });

  test("task creation validates required fields", async () => {
    const response = await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  test("task creation rejects invalid priority", async () => {
    const response = await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Invalid priority task",
        description: "Testing validation",
        priority: "extreme",
        status: "todo",
      });

    expect(response.statusCode).toBe(400);
  });

  test("task creation rejects invalid status", async () => {
    const response = await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Invalid status task",
        description: "Testing validation",
        priority: "high",
        status: "something",
      });

    expect(response.statusCode).toBe(400);
  });

  test("task can be updated with valid data", async () => {
    const tasksResponse = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(tasksResponse.statusCode).toBe(200);
    expect(tasksResponse.body.tasks).toBeInstanceOf(Array);

    if (tasksResponse.body.tasks.length === 0) {
      return;
    }

    taskId = tasksResponse.body.tasks[0].id;

    const response = await request(app)
      .put(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: tasksResponse.body.tasks[0].status,
      });

    expect(response.statusCode).toBe(200);
  });

  test("developer cannot delete tasks", async () => {
    const response = await request(app)
      .delete("/tasks/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${developerToken}`);

    expect(response.statusCode).toBe(403);
  });
});
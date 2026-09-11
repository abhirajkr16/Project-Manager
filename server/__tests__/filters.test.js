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

describe("Task Filters", () => {
  let adminToken;
  let projectId;

  beforeAll(async () => {
    adminToken = await login("admin@example.com", "admin123");

    const response = await request(app)
      .get("/projects")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.projects).toBeInstanceOf(Array);
    expect(response.body.projects.length).toBeGreaterThan(0);

    projectId = response.body.projects[0].id;
  });

  test("filter by status", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        status: "todo",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);

    expect(response.body.tasks.every((task) => task.status === "todo")).toBe(
      true,
    );
  });

  test("filter by priority", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        priority: "high",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);

    expect(response.body.tasks.every((task) => task.priority === "high")).toBe(
      true,
    );
  });

  test("filter by search", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        search: "task",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);
  });

  test("filter by due date range", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        dueFrom: "2020-01-01",
        dueTo: "2030-12-31",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);
  });

  test("rejects invalid status", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        status: "invalid-status",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
  });

  test("rejects invalid priority", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        priority: "invalid-priority",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
  });

  test("rejects invalid due date range", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        dueFrom: "2030-01-01",
        dueTo: "2020-01-01",
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
  });

  test("supports pagination limit", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        limit: 2,
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);
    expect(response.body.tasks.length).toBeLessThanOrEqual(2);
  });

  test("supports pagination offset", async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .query({
        limit: 2,
        offset: 1,
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.tasks).toBeInstanceOf(Array);
  });
});

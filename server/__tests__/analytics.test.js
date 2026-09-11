import request from "supertest";
import app from "../index.js";

describe("Analytics API", () => {
  let authToken;
  let projectId;
  let userId;

  const testUser = {
    name: "Analytics Test User",
    email: `analytics${Date.now()}@example.com`,
    password: "TestPassword123",
    role: "project_manager",
  };

  beforeAll(async () => {
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(testUser)
      .expect(201);

    authToken = registerResponse.body.accessToken;
    userId = registerResponse.body.user.id;

    expect(authToken).toBeDefined();
    expect(userId).toBeDefined();

    const projectResponse = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Analytics Test Project",
        description: "Project for analytics tests",
      })
      .expect(201);

    expect(projectResponse.body).toHaveProperty("project");
    expect(projectResponse.body.project).toHaveProperty("id");

    projectId = projectResponse.body.project.id;

    await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Analytics Task One",
        description: "First analytics task",
        priority: "high",
        status: "todo",
      })
      .expect(201);

    await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Analytics Task Two",
        description: "Second analytics task",
        priority: "medium",
        status: "done",
      })
      .expect(201);
  });

  it("should get project summary analytics", async () => {
    const response = await request(app)
      .get(`/analytics/projects/${projectId}/summary`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });

  it("should get user activity analytics", async () => {
    const response = await request(app)
      .get(`/analytics/users/${userId}/activity`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });

  it("should get project snapshot", async () => {
    const response = await request(app)
      .get(`/analytics/projects/${projectId}/snapshot`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });

  it("should support date range filtering", async () => {
    const response = await request(app)
      .get(`/analytics/projects/${projectId}/summary`)
      .query({
        from: "2020-01-01",
        to: "2030-12-31",
      })
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });

  it("should reject analytics access without authentication", async () => {
    await request(app)
      .get(`/analytics/projects/${projectId}/summary`)
      .expect(401);
  });
});

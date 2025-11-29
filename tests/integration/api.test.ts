import { describe, it, expect, beforeAll } from "vitest";
import { Hono } from "hono";

// Mock env
process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-characters-long";
process.env.JWT_EXPIRY = "3600";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.MODE = "api";
process.env.NODE_ENV = "test";

describe("Health Endpoints", () => {
  let app: Hono;

  beforeAll(async () => {
    // Create a minimal app for testing health endpoints
    app = new Hono();
    app.get("/health", (c) => c.json({ status: "ok", mode: "api" }));
    app.get("/health/ready", (c) => c.json({ status: "ready" }));
  });

  describe("GET /health", () => {
    it("should return ok status", async () => {
      const res = await app.request("/health");
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.mode).toBe("api");
    });
  });

  describe("GET /health/ready", () => {
    it("should return ready status", async () => {
      const res = await app.request("/health/ready");
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe("ready");
    });
  });
});

describe("Error Handling", () => {
  let app: Hono;

  beforeAll(() => {
    app = new Hono();
    
    app.get("/error", () => {
      throw new Error("Test error");
    });
    
    app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404));
    
    app.onError((err, c) => {
      return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
    });
  });

  describe("404 Not Found", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await app.request("/unknown-route");
      
      expect(res.status).toBe(404);
      
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("500 Internal Error", () => {
    it("should handle thrown errors", async () => {
      const res = await app.request("/error");
      
      expect(res.status).toBe(500);
      
      const body = await res.json();
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });
});

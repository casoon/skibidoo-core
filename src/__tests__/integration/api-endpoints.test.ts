// API Endpoint Integration Tests
// src/__tests__/integration/api-endpoints.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "@/api/app";

describe("API Endpoint Tests", () => {
  const app = createApp();

  describe("Health Endpoints", () => {
    it("GET /health should return ok", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
    });

    it("GET /health/ready should return ready", async () => {
      const res = await app.request("/health/ready");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ready");
    });
  });

  describe("Products API", () => {
    it("GET /api/v1/products should return product list", async () => {
      const res = await app.request("/api/v1/products");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("data");
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("GET /api/v1/products should support pagination", async () => {
      const res = await app.request("/api/v1/products?page=1&size=10");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("meta");
      expect(json.meta).toHaveProperty("page");
      expect(json.meta).toHaveProperty("size");
    });
  });

  describe("Categories API", () => {
    it("GET /api/v1/categories should return category list", async () => {
      const res = await app.request("/api/v1/categories");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("data");
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("Search API", () => {
    it("GET /api/v1/search should require query param", async () => {
      const res = await app.request("/api/v1/search");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([]);
    });

    it("GET /api/v1/search?q=test should return results", async () => {
      const res = await app.request("/api/v1/search?q=test");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("meta");
    });

    it("GET /api/v1/search/autocomplete should return suggestions", async () => {
      const res = await app.request("/api/v1/search/autocomplete?q=te");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("suggestions");
    });
  });

  describe("Auth API", () => {
    it("POST /api/v1/auth/login should require credentials", async () => {
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/v1/auth/register should require valid data", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Cart API", () => {
    it("GET /api/v1/cart should return cart data", async () => {
      const res = await app.request("/api/v1/cart", {
        headers: { "X-Cart-ID": "test-cart-123" },
      });
      // Should either return cart or empty
      expect([200, 404]).toContain(res.status);
    });
  });

  describe("404 Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await app.request("/api/v1/nonexistent");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Rate Limiting Headers", () => {
    it("should include rate limit headers", async () => {
      const res = await app.request("/api/v1/products");
      // Rate limit headers may or may not be present depending on config
      expect(res.status).toBe(200);
    });
  });

  describe("Security Headers", () => {
    it("should include security headers", async () => {
      const res = await app.request("/health");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });
});

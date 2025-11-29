import { describe, it, expect, beforeAll } from "vitest";

// Mock env before importing jwt module
process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-characters-long";
process.env.JWT_EXPIRY = "3600";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.MODE = "api";
process.env.NODE_ENV = "development";

const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = await import("@/auth/jwt");

describe("JWT Utilities", () => {
  const testPayload = {
    sub: "user-123",
    email: "test@example.com",
    role: "customer" as const,
  };

  describe("signAccessToken", () => {
    it("should create a valid access token", async () => {
      const token = await signAccessToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should create tokens with correct payload", async () => {
      const token = await signAccessToken(testPayload);
      const verified = await verifyAccessToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe(testPayload.sub);
      expect(verified?.email).toBe(testPayload.email);
      expect(verified?.role).toBe(testPayload.role);
      expect(verified?.type).toBe("access");
    });
  });

  describe("signRefreshToken", () => {
    it("should create a valid refresh token", async () => {
      const token = await signRefreshToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });

    it("should create tokens with refresh type", async () => {
      const token = await signRefreshToken(testPayload);
      const verified = await verifyRefreshToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.type).toBe("refresh");
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify valid access token", async () => {
      const token = await signAccessToken(testPayload);
      const verified = await verifyAccessToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe(testPayload.sub);
    });

    it("should reject invalid token", async () => {
      const verified = await verifyAccessToken("invalid.token.here");
      
      expect(verified).toBeNull();
    });

    it("should reject refresh token as access token", async () => {
      const refreshToken = await signRefreshToken(testPayload);
      const verified = await verifyAccessToken(refreshToken);
      
      expect(verified).toBeNull();
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify valid refresh token", async () => {
      const token = await signRefreshToken(testPayload);
      const verified = await verifyRefreshToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe(testPayload.sub);
    });

    it("should reject access token as refresh token", async () => {
      const accessToken = await signAccessToken(testPayload);
      const verified = await verifyRefreshToken(accessToken);
      
      expect(verified).toBeNull();
    });
  });
});

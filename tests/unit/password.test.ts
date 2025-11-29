import { describe, it, expect } from "vitest";

// Mock env
process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-characters-long";
process.env.JWT_EXPIRY = "3600";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";

const { hashPassword, verifyPassword } = await import("@/auth/password");

describe("Password Utilities", () => {
  const testPassword = "securePassword123!";

  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const hash = await hashPassword(testPassword);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).not.toBe(testPassword);
    });

    it("should create different hashes for same password", async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);
      
      expect(hash1).not.toBe(hash2); // Different salts
    });

    it("should create bcrypt format hash", async () => {
      const hash = await hashPassword(testPassword);
      
      expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix
      expect(hash.length).toBeGreaterThan(50);
    });
  });

  describe("verifyPassword", () => {
    it("should verify correct password", async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword("wrongPassword", hash);
      
      expect(isValid).toBe(false);
    });

    it("should reject empty password", async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword("", hash);
      
      expect(isValid).toBe(false);
    });
  });
});

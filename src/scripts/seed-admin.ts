#!/usr/bin/env tsx
/**
 * Seed initial admin user
 * Usage: pnpm seed:admin
 * 
 * Environment variables:
 *   ADMIN_EMAIL - Admin email (default: admin@example.com)
 *   ADMIN_PASSWORD - Admin password (required, min 8 chars)
 *   ADMIN_FIRST_NAME - First name (optional)
 *   ADMIN_LAST_NAME - Last name (optional)
 */

import { eq } from "drizzle-orm";
import { db, closeDatabase } from "@/db";
import { adminUsers } from "@/db/schema";
import { hashPassword } from "@/auth/password";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME || "Admin";
  const lastName = process.env.ADMIN_LAST_NAME || "User";
  
  if (!password) {
    console.error("Error: ADMIN_PASSWORD environment variable is required");
    console.error("Usage: ADMIN_PASSWORD=yourpassword pnpm seed:admin");
    process.exit(1);
  }
  
  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters");
    process.exit(1);
  }
  
  try {
    // Check if admin already exists
    const existing = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, email.toLowerCase()),
    });
    
    if (existing) {
      console.log(`Admin user already exists: ${email}`);
      console.log("To update password, use the admin panel or delete the user first.");
      await closeDatabase();
      process.exit(0);
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create admin user
    const [admin] = await db.insert(adminUsers).values({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: "super_admin",
      isActive: true,
    }).returning();
    
    console.log("Admin user created successfully!");
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  ID: ${admin.id}`);
    
    await closeDatabase();
    process.exit(0);
    
  } catch (error) {
    console.error("Error creating admin user:", error);
    await closeDatabase();
    process.exit(1);
  }
}

seedAdmin();

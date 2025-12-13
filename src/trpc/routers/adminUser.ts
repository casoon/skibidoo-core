import { z } from "zod";
import { eq, and, like, desc, asc, sql } from "drizzle-orm";
import { router, adminProcedure, publicProcedure } from "@/trpc/trpc";
import { adminUsers } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/auth/password";

const createAdminUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z.enum(["super_admin", "admin", "editor"]).default("admin"),
  isActive: z.boolean().default(true),
});

const updateAdminUserInput = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z.enum(["super_admin", "admin", "editor"]).optional(),
  isActive: z.boolean().optional(),
});

const listAdminUsersInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["super_admin", "admin", "editor"]).optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(["createdAt", "email", "lastName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const adminUserRouter = router({
  // List all admin users
  list: adminProcedure
    .input(listAdminUsersInput)
    .query(async ({ ctx, input }) => {
      const { page, limit, search, role, isActive, sortBy, sortOrder } = input;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (role) {
        conditions.push(eq(adminUsers.role, role));
      }
      if (isActive !== undefined) {
        conditions.push(eq(adminUsers.isActive, isActive));
      }
      if (search) {
        conditions.push(like(adminUsers.email, `%${search}%`));
      }

      const orderBy = sortOrder === "desc"
        ? desc(adminUsers[sortBy])
        : asc(adminUsers[sortBy]);

      const [items, countResult] = await Promise.all([
        ctx.db.query.adminUsers.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy,
          limit,
          offset,
        }),
        ctx.db.select({ count: sql<number>`count(*)` })
          .from(adminUsers)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total: Number(countResult[0]?.count ?? 0),
          totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
        },
      };
    }),

  // Get single admin user
  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const adminUser = await ctx.db.query.adminUsers.findFirst({
        where: eq(adminUsers.id, input.id),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!adminUser) {
        throw new Error("Admin user not found");
      }

      return adminUser;
    }),

  // Create admin user
  create: adminProcedure
    .input(createAdminUserInput)
    .mutation(async ({ ctx, input }) => {
      const { password, ...userData } = input;

      // Check if email already exists
      const existing = await ctx.db.query.adminUsers.findFirst({
        where: eq(adminUsers.email, userData.email.toLowerCase()),
      });

      if (existing) {
        throw new Error("Email already exists");
      }

      const passwordHash = await hashPassword(password);

      const [adminUser] = await ctx.db.insert(adminUsers).values({
        ...userData,
        email: userData.email.toLowerCase(),
        passwordHash,
      }).returning({
        id: adminUsers.id,
        email: adminUsers.email,
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
        role: adminUsers.role,
        isActive: adminUsers.isActive,
        createdAt: adminUsers.createdAt,
      });

      ctx.logger.info({ adminUserId: adminUser.id }, "Admin user created");

      return adminUser;
    }),

  // Update admin user
  update: adminProcedure
    .input(updateAdminUserInput)
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...userData } = input;

      const updateData: Record<string, unknown> = {
        ...userData,
        updatedAt: new Date(),
      };

      if (userData.email) {
        updateData.email = userData.email.toLowerCase();
      }

      if (password) {
        updateData.passwordHash = await hashPassword(password);
      }

      const [adminUser] = await ctx.db
        .update(adminUsers)
        .set(updateData)
        .where(eq(adminUsers.id, id))
        .returning({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
          isActive: adminUsers.isActive,
          updatedAt: adminUsers.updatedAt,
        });

      if (!adminUser) {
        throw new Error("Admin user not found");
      }

      ctx.logger.info({ adminUserId: id }, "Admin user updated");

      return adminUser;
    }),

  // Delete admin user
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent deleting yourself
      if (ctx.user?.id === input.id) {
        throw new Error("Cannot delete your own account");
      }

      const [deleted] = await ctx.db
        .delete(adminUsers)
        .where(eq(adminUsers.id, input.id))
        .returning();

      if (!deleted) {
        throw new Error("Admin user not found");
      }

      ctx.logger.info({ adminUserId: input.id }, "Admin user deleted");

      return { success: true };
    }),

  // Setup: Create initial admin (only works if no admins exist)
  setup: publicProcedure
    .input(createAdminUserInput)
    .mutation(async ({ ctx, input }) => {
      const { password, ...userData } = input;

      // Check if any admin exists
      const existingCount = await ctx.db.select({ count: sql<number>`count(*)` })
        .from(adminUsers);

      if (Number(existingCount[0]?.count ?? 0) > 0) {
        throw new Error("Setup already completed. Admin users exist.");
      }

      const passwordHash = await hashPassword(password);

      const [adminUser] = await ctx.db.insert(adminUsers).values({
        ...userData,
        email: userData.email.toLowerCase(),
        passwordHash,
        role: "super_admin",
      }).returning({
        id: adminUsers.id,
        email: adminUsers.email,
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
        role: adminUsers.role,
      });

      ctx.logger.info({ adminUserId: adminUser.id }, "Initial admin user created via setup");

      return adminUser;
    }),
});

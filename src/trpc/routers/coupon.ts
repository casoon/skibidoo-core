import { z } from "zod";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { coupons } from "../../db/schema";

const createCouponInput = z.object({
  code: z.string().min(3).max(100).transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.number().int().min(0), // percentage in basis points (1000 = 10%) or fixed in cents
  minPurchase: z.number().int().optional(),
  maxDiscount: z.number().int().optional(),
  usageLimit: z.number().int().optional(),
  usageLimitPerCustomer: z.number().int().default(1),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  excludeProductIds: z.array(z.string().uuid()).optional(),
  excludeCategoryIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().default(true),
});

const updateCouponInput = createCouponInput.partial().extend({
  id: z.string().uuid(),
});

const listCouponsInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  type: z.enum(["percentage", "fixed", "free_shipping"]).optional(),
  isActive: z.boolean().optional(),
  includeExpired: z.boolean().default(false),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "code", "usageCount", "expiresAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const couponRouter = router({
  list: adminProcedure
    .input(listCouponsInput)
    .query(async ({ ctx, input }) => {
      const { page, limit, type, isActive, includeExpired, search, sortBy, sortOrder } = input;
      const offset = (page - 1) * limit;
      
      const conditions = [];
      if (type) conditions.push(eq(coupons.type, type));
      if (isActive !== undefined) conditions.push(eq(coupons.isActive, isActive));
      if (!includeExpired) {
        conditions.push(
          sql`(${coupons.expiresAt} IS NULL OR ${coupons.expiresAt} > NOW())`
        );
      }
      if (search) {
        conditions.push(sql`${coupons.code} ILIKE ${"%%" + search + "%%"}`);
      }
      
      const orderBy = sortOrder === "desc" 
        ? desc(coupons[sortBy]) 
        : asc(coupons[sortBy]);
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const [items, countResult] = await Promise.all([
        ctx.db.query.coupons.findMany({
          where: whereClause,
          orderBy,
          limit,
          offset,
        }),
        ctx.db.select({ count: sql<number>`count(*)` })
          .from(coupons)
          .where(whereClause),
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

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const coupon = await ctx.db.query.coupons.findFirst({
        where: eq(coupons.id, input.id),
      });
      if (!coupon) throw new Error("Coupon not found");
      return coupon;
    }),

  getByCode: adminProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const coupon = await ctx.db.query.coupons.findFirst({
        where: eq(coupons.code, input.code.toUpperCase()),
      });
      if (!coupon) throw new Error("Coupon not found");
      return coupon;
    }),

  create: adminProcedure
    .input(createCouponInput)
    .mutation(async ({ ctx, input }) => {
      const { startsAt, expiresAt, ...data } = input;
      
      const [coupon] = await ctx.db.insert(coupons).values({
        ...data,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }).returning();
      
      ctx.logger.info({ couponId: coupon.id, code: coupon.code }, "Coupon created");
      return coupon;
    }),

  update: adminProcedure
    .input(updateCouponInput)
    .mutation(async ({ ctx, input }) => {
      const { id, startsAt, expiresAt, ...data } = input;
      
      const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
      
      const [coupon] = await ctx.db
        .update(coupons)
        .set(updateData)
        .where(eq(coupons.id, id))
        .returning();
      
      if (!coupon) throw new Error("Coupon not found");
      ctx.logger.info({ couponId: id }, "Coupon updated");
      return coupon;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(coupons)
        .where(eq(coupons.id, input.id))
        .returning();
      if (!deleted) throw new Error("Coupon not found");
      ctx.logger.info({ couponId: input.id }, "Coupon deleted");
      return { success: true };
    }),

  // Validate coupon for use
  validate: adminProcedure
    .input(z.object({
      code: z.string(),
      cartTotal: z.number().int(),
      customerId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const coupon = await ctx.db.query.coupons.findFirst({
        where: eq(coupons.code, input.code.toUpperCase()),
      });
      
      if (!coupon) {
        return { valid: false, reason: "Coupon not found" };
      }
      
      if (!coupon.isActive) {
        return { valid: false, reason: "Coupon is inactive" };
      }
      
      const now = new Date();
      if (coupon.startsAt && coupon.startsAt > now) {
        return { valid: false, reason: "Coupon not yet active" };
      }
      
      if (coupon.expiresAt && coupon.expiresAt < now) {
        return { valid: false, reason: "Coupon has expired" };
      }
      
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return { valid: false, reason: "Coupon usage limit reached" };
      }
      
      if (coupon.minPurchase && input.cartTotal < coupon.minPurchase) {
        return { 
          valid: false, 
          reason: `Minimum purchase of ${coupon.minPurchase} cents required` 
        };
      }
      
      // Calculate discount
      let discount = 0;
      if (coupon.type === "percentage") {
        discount = Math.floor(input.cartTotal * coupon.value / 10000);
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else if (coupon.type === "fixed") {
        discount = Math.min(coupon.value, input.cartTotal);
      }
      
      return {
        valid: true,
        coupon,
        discount,
        type: coupon.type,
      };
    }),

  // Increment usage count (called after successful order)
  incrementUsage: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [coupon] = await ctx.db
        .update(coupons)
        .set({ 
          usageCount: sql`${coupons.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(coupons.id, input.id))
        .returning();
      
      if (!coupon) throw new Error("Coupon not found");
      ctx.logger.info({ couponId: input.id, usageCount: coupon.usageCount }, "Coupon usage incremented");
      return coupon;
    }),
});

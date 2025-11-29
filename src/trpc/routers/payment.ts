import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { paymentMethods } from "../../db/schema";

const createPaymentMethodInput = z.object({
  slug: z.string().max(100),
  name: z.string().max(255),
  description: z.string().optional(),
  provider: z.enum(["stripe", "paypal", "klarna", "mollie", "manual", "invoice", "prepayment"]),
  providerConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
  minAmount: z.number().int().optional(),
  maxAmount: z.number().int().optional(),
  countries: z.array(z.string().length(2)).optional(),
});

const updatePaymentMethodInput = createPaymentMethodInput.partial().extend({
  id: z.string().uuid(),
});

export const paymentRouter = router({
  list: adminProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = input?.includeInactive ? undefined : eq(paymentMethods.isActive, true);
      const items = await ctx.db.query.paymentMethods.findMany({
        where: conditions,
        orderBy: [asc(paymentMethods.position)],
      });
      return { items };
    }),

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const method = await ctx.db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, input.id),
      });
      if (!method) throw new Error("Payment method not found");
      return method;
    }),

  getBySlug: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const method = await ctx.db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.slug, input.slug),
      });
      if (!method) throw new Error("Payment method not found");
      return method;
    }),

  create: adminProcedure
    .input(createPaymentMethodInput)
    .mutation(async ({ ctx, input }) => {
      const [method] = await ctx.db.insert(paymentMethods).values(input).returning();
      ctx.logger.info({ methodId: method.id, provider: input.provider }, "Payment method created");
      return method;
    }),

  update: adminProcedure
    .input(updatePaymentMethodInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [method] = await ctx.db
        .update(paymentMethods)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(paymentMethods.id, id))
        .returning();
      if (!method) throw new Error("Payment method not found");
      ctx.logger.info({ methodId: id }, "Payment method updated");
      return method;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(paymentMethods)
        .where(eq(paymentMethods.id, input.id))
        .returning();
      if (!deleted) throw new Error("Payment method not found");
      ctx.logger.info({ methodId: input.id }, "Payment method deleted");
      return { success: true };
    }),

  reorder: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.string().uuid(),
        position: z.number().int(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        for (const item of input.items) {
          await tx
            .update(paymentMethods)
            .set({ position: item.position, updatedAt: new Date() })
            .where(eq(paymentMethods.id, item.id));
        }
      });
      ctx.logger.info({ count: input.items.length }, "Payment methods reordered");
      return { success: true };
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const method = await ctx.db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, input.id),
      });
      if (!method) throw new Error("Payment method not found");
      
      const [updated] = await ctx.db
        .update(paymentMethods)
        .set({ isActive: !method.isActive, updatedAt: new Date() })
        .where(eq(paymentMethods.id, input.id))
        .returning();
      
      ctx.logger.info({ methodId: input.id, isActive: updated.isActive }, "Payment method toggled");
      return updated;
    }),
});

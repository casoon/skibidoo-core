import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { taxClasses, taxRates } from "../../db/schema";

// Tax Classes
const createTaxClassInput = z.object({
  slug: z.string().max(100),
  name: z.string().max(255),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

const updateTaxClassInput = createTaxClassInput.partial().extend({
  id: z.string().uuid(),
});

// Tax Rates
const createTaxRateInput = z.object({
  taxClassId: z.string().uuid(),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  rate: z.number().int().min(0).max(10000), // basis points (1900 = 19%)
  name: z.string().max(100), // e.g., "MwSt.", "VAT"
  priority: z.number().int().default(0),
  compound: z.boolean().default(false),
});

const updateTaxRateInput = createTaxRateInput.partial().extend({
  id: z.string().uuid(),
});

export const taxRouter = router({
  // === TAX CLASSES ===
  classes: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const items = await ctx.db.query.taxClasses.findMany({
        with: {
          rates: true,
        },
        orderBy: [asc(taxClasses.name)],
      });
      return { items };
    }),

    get: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const taxClass = await ctx.db.query.taxClasses.findFirst({
          where: eq(taxClasses.id, input.id),
          with: {
            rates: {
              orderBy: [asc(taxRates.priority), asc(taxRates.country)],
            },
          },
        });
        if (!taxClass) throw new Error("Tax class not found");
        return taxClass;
      }),

    create: adminProcedure
      .input(createTaxClassInput)
      .mutation(async ({ ctx, input }) => {
        // If setting as default, unset others
        if (input.isDefault) {
          await ctx.db
            .update(taxClasses)
            .set({ isDefault: false, updatedAt: new Date() });
        }
        
        const [taxClass] = await ctx.db.insert(taxClasses).values(input).returning();
        ctx.logger.info({ taxClassId: taxClass.id }, "Tax class created");
        return taxClass;
      }),

    update: adminProcedure
      .input(updateTaxClassInput)
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        
        // If setting as default, unset others
        if (data.isDefault) {
          await ctx.db
            .update(taxClasses)
            .set({ isDefault: false, updatedAt: new Date() });
        }
        
        const [taxClass] = await ctx.db
          .update(taxClasses)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(taxClasses.id, id))
          .returning();
        
        if (!taxClass) throw new Error("Tax class not found");
        ctx.logger.info({ taxClassId: id }, "Tax class updated");
        return taxClass;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await ctx.db
          .delete(taxClasses)
          .where(eq(taxClasses.id, input.id))
          .returning();
        if (!deleted) throw new Error("Tax class not found");
        ctx.logger.info({ taxClassId: input.id }, "Tax class deleted");
        return { success: true };
      }),
  }),

  // === TAX RATES ===
  rates: router({
    list: adminProcedure
      .input(z.object({ taxClassId: z.string().uuid().optional() }))
      .query(async ({ ctx, input }) => {
        const conditions = input.taxClassId 
          ? eq(taxRates.taxClassId, input.taxClassId) 
          : undefined;
        
        const items = await ctx.db.query.taxRates.findMany({
          where: conditions,
          orderBy: [asc(taxRates.priority), asc(taxRates.country)],
        });
        return { items };
      }),

    get: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const rate = await ctx.db.query.taxRates.findFirst({
          where: eq(taxRates.id, input.id),
        });
        if (!rate) throw new Error("Tax rate not found");
        return rate;
      }),

    create: adminProcedure
      .input(createTaxRateInput)
      .mutation(async ({ ctx, input }) => {
        const [rate] = await ctx.db.insert(taxRates).values(input).returning();
        ctx.logger.info({ rateId: rate.id, country: input.country }, "Tax rate created");
        return rate;
      }),

    update: adminProcedure
      .input(updateTaxRateInput)
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [rate] = await ctx.db
          .update(taxRates)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(taxRates.id, id))
          .returning();
        if (!rate) throw new Error("Tax rate not found");
        ctx.logger.info({ rateId: id }, "Tax rate updated");
        return rate;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await ctx.db
          .delete(taxRates)
          .where(eq(taxRates.id, input.id))
          .returning();
        if (!deleted) throw new Error("Tax rate not found");
        ctx.logger.info({ rateId: input.id }, "Tax rate deleted");
        return { success: true };
      }),
  }),

  // Calculate tax for a given location and tax class
  calculate: adminProcedure
    .input(z.object({
      taxClassId: z.string().uuid(),
      country: z.string().length(2),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      amount: z.number().int(), // net amount in cents
    }))
    .query(async ({ ctx, input }) => {
      // Find applicable tax rates (most specific first)
      const rates = await ctx.db.query.taxRates.findMany({
        where: and(
          eq(taxRates.taxClassId, input.taxClassId),
          eq(taxRates.country, input.country)
        ),
        orderBy: [asc(taxRates.priority)],
      });
      
      // Filter by specificity
      let applicableRates = rates;
      
      if (input.state) {
        const stateRates = rates.filter((r) => r.state === input.state);
        if (stateRates.length > 0) applicableRates = stateRates;
      }
      
      if (input.postalCode) {
        const postalRates = applicableRates.filter((r) => r.postalCode === input.postalCode);
        if (postalRates.length > 0) applicableRates = postalRates;
      }
      
      if (applicableRates.length === 0) {
        return {
          rates: [],
          totalRate: 0,
          taxAmount: 0,
          grossAmount: input.amount,
        };
      }
      
      // Calculate tax (handle compound rates)
      let totalTax = 0;
      let baseAmount = input.amount;
      const appliedRates: Array<{ name: string; rate: number; amount: number }> = [];
      
      for (const rate of applicableRates) {
        const taxAmount = Math.floor(baseAmount * rate.rate / 10000);
        appliedRates.push({
          name: rate.name,
          rate: rate.rate,
          amount: taxAmount,
        });
        totalTax += taxAmount;
        
        if (rate.compound) {
          baseAmount += taxAmount;
        }
      }
      
      return {
        rates: appliedRates,
        totalRate: appliedRates.reduce((sum, r) => sum + r.rate, 0),
        taxAmount: totalTax,
        grossAmount: input.amount + totalTax,
      };
    }),
});

import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { router, adminProcedure } from "@/trpc/trpc";
import { deliveryTimes, deliveryTimeTranslations, products } from "@/db/schema";

const createDeliveryTimeInput = z.object({
  slug: z.string().min(1).max(100),
  minDays: z.number().int().min(0),
  maxDays: z.number().int().min(0),
  translations: z.array(z.object({
    locale: z.string().max(10),
    name: z.string().max(255),
  })).min(1),
});

const updateDeliveryTimeInput = createDeliveryTimeInput.partial().extend({
  id: z.string().uuid(),
});

export const deliveryTimeRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.query.deliveryTimes.findMany({
      with: {
        translations: true,
      },
      orderBy: [asc(deliveryTimes.minDays)],
    });
    
    return { items };
  }),

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deliveryTime = await ctx.db.query.deliveryTimes.findFirst({
        where: eq(deliveryTimes.id, input.id),
        with: {
          translations: true,
        },
      });
      
      if (!deliveryTime) {
        throw new Error("Delivery time not found");
      }
      
      return deliveryTime;
    }),

  getBySlug: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const deliveryTime = await ctx.db.query.deliveryTimes.findFirst({
        where: eq(deliveryTimes.slug, input.slug),
        with: {
          translations: true,
        },
      });
      
      if (!deliveryTime) {
        throw new Error("Delivery time not found");
      }
      
      return deliveryTime;
    }),

  create: adminProcedure
    .input(createDeliveryTimeInput)
    .mutation(async ({ ctx, input }) => {
      const { translations, ...data } = input;
      
      if (data.minDays > data.maxDays) {
        throw new Error("minDays cannot be greater than maxDays");
      }
      
      return await ctx.db.transaction(async (tx) => {
        const [deliveryTime] = await tx.insert(deliveryTimes).values(data).returning();
        
        if (translations.length > 0) {
          await tx.insert(deliveryTimeTranslations).values(
            translations.map((t) => ({
              deliveryTimeId: deliveryTime.id,
              ...t,
            }))
          );
        }
        
        ctx.logger.info({ deliveryTimeId: deliveryTime.id }, "Delivery time created");
        
        return deliveryTime;
      });
    }),

  update: adminProcedure
    .input(updateDeliveryTimeInput)
    .mutation(async ({ ctx, input }) => {
      const { id, translations, ...data } = input;
      
      if (data.minDays !== undefined && data.maxDays !== undefined && data.minDays > data.maxDays) {
        throw new Error("minDays cannot be greater than maxDays");
      }
      
      return await ctx.db.transaction(async (tx) => {
        const [deliveryTime] = await tx
          .update(deliveryTimes)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(deliveryTimes.id, id))
          .returning();
        
        if (!deliveryTime) {
          throw new Error("Delivery time not found");
        }
        
        if (translations) {
          await tx.delete(deliveryTimeTranslations).where(eq(deliveryTimeTranslations.deliveryTimeId, id));
          if (translations.length > 0) {
            await tx.insert(deliveryTimeTranslations).values(
              translations.map((t) => ({
                deliveryTimeId: id,
                ...t,
              }))
            );
          }
        }
        
        ctx.logger.info({ deliveryTimeId: id }, "Delivery time updated");
        
        return deliveryTime;
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if used by any products
      const productsUsing = await ctx.db.query.products.findFirst({
        where: eq(products.deliveryTimeId, input.id),
      });
      
      if (productsUsing) {
        throw new Error("Cannot delete delivery time that is used by products");
      }
      
      const [deleted] = await ctx.db
        .delete(deliveryTimes)
        .where(eq(deliveryTimes.id, input.id))
        .returning();
      
      if (!deleted) {
        throw new Error("Delivery time not found");
      }
      
      ctx.logger.info({ deliveryTimeId: input.id }, "Delivery time deleted");
      
      return { success: true };
    }),

  // Seed default German delivery times
  seedDefaults: adminProcedure.mutation(async ({ ctx }) => {
    const defaults = [
      { slug: "sofort", minDays: 0, maxDays: 0, de: "Sofort lieferbar", en: "In stock" },
      { slug: "1-2-tage", minDays: 1, maxDays: 2, de: "1-2 Werktage", en: "1-2 business days" },
      { slug: "2-3-tage", minDays: 2, maxDays: 3, de: "2-3 Werktage", en: "2-3 business days" },
      { slug: "3-5-tage", minDays: 3, maxDays: 5, de: "3-5 Werktage", en: "3-5 business days" },
      { slug: "1-2-wochen", minDays: 5, maxDays: 10, de: "1-2 Wochen", en: "1-2 weeks" },
      { slug: "2-4-wochen", minDays: 10, maxDays: 20, de: "2-4 Wochen", en: "2-4 weeks" },
      { slug: "auf-anfrage", minDays: 0, maxDays: 0, de: "Lieferzeit auf Anfrage", en: "Delivery on request" },
    ];
    
    const created: string[] = [];
    
    for (const def of defaults) {
      const existing = await ctx.db.query.deliveryTimes.findFirst({
        where: eq(deliveryTimes.slug, def.slug),
      });
      
      if (!existing) {
        const [dt] = await ctx.db.insert(deliveryTimes).values({
          slug: def.slug,
          minDays: def.minDays,
          maxDays: def.maxDays,
        }).returning();
        
        await ctx.db.insert(deliveryTimeTranslations).values([
          { deliveryTimeId: dt.id, locale: "de-DE", name: def.de },
          { deliveryTimeId: dt.id, locale: "en-US", name: def.en },
        ]);
        
        created.push(def.slug);
      }
    }
    
    ctx.logger.info({ created }, "Default delivery times seeded");
    
    return { created, count: created.length };
  }),
});

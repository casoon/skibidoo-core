import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { router, adminProcedure } from "@/trpc/trpc";
import { shippingZones, shippingMethods, shippingClasses } from "@/db/schema";

// Shipping Zones
const createZoneInput = z.object({
  name: z.string().max(255),
  description: z.string().optional(),
  countries: z.array(z.string().length(2)), // ISO country codes
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateZoneInput = createZoneInput.partial().extend({
  id: z.string().uuid(),
});

// Shipping Methods
const createMethodInput = z.object({
  zoneId: z.string().uuid(),
  slug: z.string().max(100),
  name: z.string().max(255),
  description: z.string().optional(),
  type: z.enum(["flat", "weight", "price", "free"]).default("flat"),
  price: z.number().int().default(0),
  freeAbove: z.number().int().optional(),
  pricePerKg: z.number().int().optional(),
  deliveryTimeId: z.string().uuid().optional(),
  carrierCode: z.string().max(50).optional(),
  carrierConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

const updateMethodInput = createMethodInput.partial().extend({
  id: z.string().uuid(),
});

// Shipping Classes
const createClassInput = z.object({
  slug: z.string().max(100),
  name: z.string().max(255),
  description: z.string().optional(),
});

const updateClassInput = createClassInput.partial().extend({
  id: z.string().uuid(),
});

export const shippingRouter = router({
  // === ZONES ===
  zones: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const items = await ctx.db.query.shippingZones.findMany({
        with: {
          methods: true,
        },
        orderBy: [asc(shippingZones.priority), asc(shippingZones.name)],
      });
      return { items };
    }),

    get: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const zone = await ctx.db.query.shippingZones.findFirst({
          where: eq(shippingZones.id, input.id),
          with: {
            methods: true,
          },
        });
        if (!zone) throw new Error("Shipping zone not found");
        return zone;
      }),

    create: adminProcedure
      .input(createZoneInput)
      .mutation(async ({ ctx, input }) => {
        const [zone] = await ctx.db.insert(shippingZones).values(input).returning();
        ctx.logger.info({ zoneId: zone.id }, "Shipping zone created");
        return zone;
      }),

    update: adminProcedure
      .input(updateZoneInput)
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [zone] = await ctx.db
          .update(shippingZones)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(shippingZones.id, id))
          .returning();
        if (!zone) throw new Error("Shipping zone not found");
        ctx.logger.info({ zoneId: id }, "Shipping zone updated");
        return zone;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await ctx.db
          .delete(shippingZones)
          .where(eq(shippingZones.id, input.id))
          .returning();
        if (!deleted) throw new Error("Shipping zone not found");
        ctx.logger.info({ zoneId: input.id }, "Shipping zone deleted");
        return { success: true };
      }),
  }),

  // === METHODS ===
  methods: router({
    list: adminProcedure
      .input(z.object({ zoneId: z.string().uuid().optional() }))
      .query(async ({ ctx, input }) => {
        const conditions = input.zoneId ? eq(shippingMethods.zoneId, input.zoneId) : undefined;
        const items = await ctx.db.query.shippingMethods.findMany({
          where: conditions,
          orderBy: [asc(shippingMethods.position)],
        });
        return { items };
      }),

    get: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const method = await ctx.db.query.shippingMethods.findFirst({
          where: eq(shippingMethods.id, input.id),
        });
        if (!method) throw new Error("Shipping method not found");
        return method;
      }),

    create: adminProcedure
      .input(createMethodInput)
      .mutation(async ({ ctx, input }) => {
        const [method] = await ctx.db.insert(shippingMethods).values(input).returning();
        ctx.logger.info({ methodId: method.id }, "Shipping method created");
        return method;
      }),

    update: adminProcedure
      .input(updateMethodInput)
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [method] = await ctx.db
          .update(shippingMethods)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(shippingMethods.id, id))
          .returning();
        if (!method) throw new Error("Shipping method not found");
        ctx.logger.info({ methodId: id }, "Shipping method updated");
        return method;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await ctx.db
          .delete(shippingMethods)
          .where(eq(shippingMethods.id, input.id))
          .returning();
        if (!deleted) throw new Error("Shipping method not found");
        ctx.logger.info({ methodId: input.id }, "Shipping method deleted");
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
              .update(shippingMethods)
              .set({ position: item.position, updatedAt: new Date() })
              .where(eq(shippingMethods.id, item.id));
          }
        });
        return { success: true };
      }),
  }),

  // === CLASSES ===
  classes: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const items = await ctx.db.query.shippingClasses.findMany({
        orderBy: [asc(shippingClasses.name)],
      });
      return { items };
    }),

    get: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const shippingClass = await ctx.db.query.shippingClasses.findFirst({
          where: eq(shippingClasses.id, input.id),
        });
        if (!shippingClass) throw new Error("Shipping class not found");
        return shippingClass;
      }),

    create: adminProcedure
      .input(createClassInput)
      .mutation(async ({ ctx, input }) => {
        const [shippingClass] = await ctx.db.insert(shippingClasses).values(input).returning();
        ctx.logger.info({ classId: shippingClass.id }, "Shipping class created");
        return shippingClass;
      }),

    update: adminProcedure
      .input(updateClassInput)
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const [shippingClass] = await ctx.db
          .update(shippingClasses)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(shippingClasses.id, id))
          .returning();
        if (!shippingClass) throw new Error("Shipping class not found");
        ctx.logger.info({ classId: id }, "Shipping class updated");
        return shippingClass;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await ctx.db
          .delete(shippingClasses)
          .where(eq(shippingClasses.id, input.id))
          .returning();
        if (!deleted) throw new Error("Shipping class not found");
        ctx.logger.info({ classId: input.id }, "Shipping class deleted");
        return { success: true };
      }),
  }),
});

import { z } from "zod";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { orders, orderItems, orderTaxLines, invoices } from "../../db/schema";

const addressSchema = z.object({
  company: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  street: z.string(),
  streetNumber: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string(),
  state: z.string().optional(),
  postalCode: z.string(),
  country: z.string().length(2),
  phone: z.string().optional(),
});

const listOrdersInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  fulfillmentStatus: z.string().optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "total", "orderNumber"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const updateOrderStatusInput = z.object({
  id: z.string().uuid(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  fulfillmentStatus: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  internalNote: z.string().optional(),
});

export const orderRouter = router({
  list: adminProcedure
    .input(listOrdersInput)
    .query(async ({ ctx, input }) => {
      const { page, limit, status, paymentStatus, fulfillmentStatus, customerId, dateFrom, dateTo, sortBy, sortOrder } = input;
      const offset = (page - 1) * limit;
      
      const conditions = [];
      if (status) conditions.push(eq(orders.status, status));
      if (paymentStatus) conditions.push(eq(orders.paymentStatus, paymentStatus));
      if (fulfillmentStatus) conditions.push(eq(orders.fulfillmentStatus, fulfillmentStatus));
      if (customerId) conditions.push(eq(orders.customerId, customerId));
      if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)));
      
      const orderBy = sortOrder === "desc" 
        ? desc(orders[sortBy]) 
        : asc(orders[sortBy]);
      
      const [items, countResult] = await Promise.all([
        ctx.db.query.orders.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          with: {
            items: true,
            customer: {
              columns: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy,
          limit,
          offset,
        }),
        ctx.db.select({ count: sql<number>`count(*)` })
          .from(orders)
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

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: eq(orders.id, input.id),
        with: {
          items: true,
          taxLines: true,
          invoices: true,
          customer: true,
        },
      });
      
      if (!order) {
        throw new Error("Order not found");
      }
      
      return order;
    }),

  updateStatus: adminProcedure
    .input(updateOrderStatusInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      
      const now = new Date();
      const updates: Record<string, unknown> = { ...updateData, updatedAt: now };
      
      // Set timestamp based on status changes
      if (updateData.paymentStatus === "paid") {
        updates.paidAt = now;
      }
      if (updateData.fulfillmentStatus === "shipped") {
        updates.shippedAt = now;
      }
      if (updateData.fulfillmentStatus === "delivered") {
        updates.deliveredAt = now;
      }
      if (updateData.status === "cancelled") {
        updates.cancelledAt = now;
      }
      
      const [order] = await ctx.db
        .update(orders)
        .set(updates)
        .where(eq(orders.id, id))
        .returning();
      
      if (!order) {
        throw new Error("Order not found");
      }
      
      ctx.logger.info({ orderId: id, updates: updateData }, "Order status updated");
      
      return order;
    }),

  // Generate invoice
  createInvoice: adminProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: eq(orders.id, input.orderId),
        with: {
          items: true,
          taxLines: true,
        },
      });
      
      if (!order) {
        throw new Error("Order not found");
      }
      
      // Generate sequential invoice number
      const lastInvoice = await ctx.db.query.invoices.findFirst({
        orderBy: desc(invoices.createdAt),
        columns: { invoiceNumber: true },
      });
      
      const year = new Date().getFullYear();
      let nextNumber = 1;
      
      if (lastInvoice?.invoiceNumber) {
        const match = lastInvoice.invoiceNumber.match(/RE-(\d{4})-(\d+)/);
        if (match && match[1] === String(year)) {
          nextNumber = parseInt(match[2], 10) + 1;
        }
      }
      
      const invoiceNumber = `RE-${year}-${String(nextNumber).padStart(6, "0")}`;
      
      const [invoice] = await ctx.db.insert(invoices).values({
        orderId: input.orderId,
        invoiceNumber,
        data: order,
        status: "final",
      }).returning();
      
      ctx.logger.info({ invoiceId: invoice.id, invoiceNumber }, "Invoice created");
      
      return invoice;
    }),

  // Get order statistics
  stats: adminProcedure
    .input(z.object({
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.dateFrom) conditions.push(gte(orders.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(orders.createdAt, new Date(input.dateTo)));
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const [totalOrders] = await ctx.db
        .select({ 
          count: sql<number>`count(*)`,
          revenue: sql<number>`sum(total)`,
        })
        .from(orders)
        .where(whereClause);
      
      const [pendingOrders] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.status, "pending"), whereClause));
      
      const [unpaidOrders] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.paymentStatus, "pending"), whereClause));
      
      return {
        totalOrders: Number(totalOrders?.count ?? 0),
        revenue: Number(totalOrders?.revenue ?? 0),
        pendingOrders: Number(pendingOrders?.count ?? 0),
        unpaidOrders: Number(unpaidOrders?.count ?? 0),
      };
    }),
});

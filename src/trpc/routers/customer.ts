import { z } from "zod";
import { eq, and, like, desc, asc, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { customers, customerAddresses, customerGroups, customerGroupMembers } from "../../db/schema";

const addressSchema = z.object({
  type: z.enum(["billing", "shipping"]).default("shipping"),
  isDefault: z.boolean().default(false),
  company: z.string().max(255).optional(),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  street: z.string().max(255),
  streetNumber: z.string().max(20).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20),
  country: z.string().length(2),
  phone: z.string().max(50).optional(),
});

const createCustomerInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  status: z.enum(["active", "inactive", "banned"]).default("active"),
  taxExempt: z.boolean().default(false),
  vatId: z.string().max(50).optional(),
  locale: z.string().max(10).default("de-DE"),
  currency: z.string().length(3).default("EUR"),
  addresses: z.array(addressSchema).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
});

const updateCustomerInput = createCustomerInput.partial().extend({
  id: z.string().uuid(),
});

const listCustomersInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "inactive", "banned"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "email", "lastName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const customerRouter = router({
  list: adminProcedure
    .input(listCustomersInput)
    .query(async ({ ctx, input }) => {
      const { page, limit, status, search, sortBy, sortOrder } = input;
      const offset = (page - 1) * limit;
      
      const conditions = [];
      if (status) {
        conditions.push(eq(customers.status, status));
      }
      if (search) {
        conditions.push(like(customers.email, `%${search}%`));
      }
      
      const orderBy = sortOrder === "desc" 
        ? desc(customers[sortBy]) 
        : asc(customers[sortBy]);
      
      const [items, countResult] = await Promise.all([
        ctx.db.query.customers.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          with: {
            addresses: true,
            groups: true,
          },
          orderBy,
          limit,
          offset,
        }),
        ctx.db.select({ count: sql<number>`count(*)` })
          .from(customers)
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
      const customer = await ctx.db.query.customers.findFirst({
        where: eq(customers.id, input.id),
        with: {
          addresses: true,
          groups: true,
        },
      });
      
      if (!customer) {
        throw new Error("Customer not found");
      }
      
      return customer;
    }),

  create: adminProcedure
    .input(createCustomerInput)
    .mutation(async ({ ctx, input }) => {
      const { password, addresses, groupIds, ...customerData } = input;
      
      // TODO: Hash password
      const passwordHash = password ? password : undefined;
      
      return await ctx.db.transaction(async (tx) => {
        const [customer] = await tx.insert(customers).values({
          ...customerData,
          passwordHash,
        }).returning();
        
        if (addresses && addresses.length > 0) {
          await tx.insert(customerAddresses).values(
            addresses.map((addr) => ({
              customerId: customer.id,
              ...addr,
            }))
          );
        }
        
        if (groupIds && groupIds.length > 0) {
          await tx.insert(customerGroupMembers).values(
            groupIds.map((groupId) => ({
              customerId: customer.id,
              groupId,
            }))
          );
        }
        
        ctx.logger.info({ customerId: customer.id }, "Customer created");
        
        return customer;
      });
    }),

  update: adminProcedure
    .input(updateCustomerInput)
    .mutation(async ({ ctx, input }) => {
      const { id, password, addresses, groupIds, ...customerData } = input;
      
      return await ctx.db.transaction(async (tx) => {
        const updateData: Record<string, unknown> = { 
          ...customerData, 
          updatedAt: new Date() 
        };
        
        if (password) {
          // TODO: Hash password
          updateData.passwordHash = password;
        }
        
        const [customer] = await tx
          .update(customers)
          .set(updateData)
          .where(eq(customers.id, id))
          .returning();
        
        if (!customer) {
          throw new Error("Customer not found");
        }
        
        ctx.logger.info({ customerId: id }, "Customer updated");
        
        return customer;
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(customers)
        .where(eq(customers.id, input.id))
        .returning();
      
      if (!deleted) {
        throw new Error("Customer not found");
      }
      
      ctx.logger.info({ customerId: input.id }, "Customer deleted");
      
      return { success: true };
    }),

  // Address management
  addAddress: adminProcedure
    .input(addressSchema.extend({ customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { customerId, ...addressData } = input;
      
      const [address] = await ctx.db.insert(customerAddresses).values({
        customerId,
        ...addressData,
      }).returning();
      
      return address;
    }),

  updateAddress: adminProcedure
    .input(addressSchema.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...addressData } = input;
      
      const [address] = await ctx.db
        .update(customerAddresses)
        .set({ ...addressData, updatedAt: new Date() })
        .where(eq(customerAddresses.id, id))
        .returning();
      
      if (!address) {
        throw new Error("Address not found");
      }
      
      return address;
    }),

  deleteAddress: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(customerAddresses)
        .where(eq(customerAddresses.id, input.id))
        .returning();
      
      if (!deleted) {
        throw new Error("Address not found");
      }
      
      return { success: true };
    }),
});

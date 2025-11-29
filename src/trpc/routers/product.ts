import { z } from "zod";
import { eq, and, like, desc, asc, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { products, productTranslations, categories, productCategories } from "../../db/schema";

// Input schemas
const createProductInput = z.object({
  sku: z.string().min(1).max(100),
  slug: z.string().min(1).max(255),
  type: z.enum(["simple", "variant", "bundle"]).default("simple"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  
  // Pricing
  priceNet: z.number().int().min(0),
  priceGross: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).optional(),
  costPrice: z.number().int().min(0).optional(),
  taxClassId: z.string().uuid().optional(),
  
  // Base price (Grundpreis)
  basePriceAmount: z.number().int().optional(),
  basePriceUnit: z.string().max(20).optional(),
  basePriceReference: z.number().int().optional(),
  
  // Inventory
  trackInventory: z.boolean().default(true),
  stockQuantity: z.number().int().default(0),
  lowStockThreshold: z.number().int().optional(),
  allowBackorder: z.boolean().default(false),
  
  // Shipping
  weight: z.number().int().optional(),
  length: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  shippingClassId: z.string().uuid().optional(),
  deliveryTimeId: z.string().uuid().optional(),
  
  // SEO
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().optional(),
  
  // Parent
  parentId: z.string().uuid().optional(),
  
  // Translations
  translations: z.array(z.object({
    locale: z.string().max(10),
    name: z.string().max(255),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
  })).min(1),
  
  // Categories
  categoryIds: z.array(z.string().uuid()).optional(),
});

const updateProductInput = createProductInput.partial().extend({
  id: z.string().uuid(),
});

const listProductsInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "active", "archived"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "sku", "priceGross"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const productRouter = router({
  // List products
  list: adminProcedure
    .input(listProductsInput)
    .query(async ({ ctx, input }) => {
      const { page, limit, status, search, sortBy, sortOrder } = input;
      const offset = (page - 1) * limit;
      
      const conditions = [];
      if (status) {
        conditions.push(eq(products.status, status));
      }
      if (search) {
        conditions.push(like(products.sku, `%${search}%`));
      }
      
      const orderBy = sortOrder === "desc" 
        ? desc(products[sortBy]) 
        : asc(products[sortBy]);
      
      const [items, countResult] = await Promise.all([
        ctx.db.query.products.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          with: {
            translations: true,
            categories: {
              with: {
                // category relation would need to be added
              },
            },
          },
          orderBy,
          limit,
          offset,
        }),
        ctx.db.select({ count: sql<number>`count(*)` })
          .from(products)
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

  // Get single product
  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: eq(products.id, input.id),
        with: {
          translations: true,
          categories: true,
          deliveryTime: {
            with: {
              // translations would be added
            },
          },
        },
      });
      
      if (!product) {
        throw new Error("Product not found");
      }
      
      return product;
    }),

  // Create product
  create: adminProcedure
    .input(createProductInput)
    .mutation(async ({ ctx, input }) => {
      const { translations, categoryIds, ...productData } = input;
      
      return await ctx.db.transaction(async (tx) => {
        // Insert product
        const [product] = await tx.insert(products).values(productData).returning();
        
        // Insert translations
        if (translations.length > 0) {
          await tx.insert(productTranslations).values(
            translations.map((t) => ({
              productId: product.id,
              ...t,
            }))
          );
        }
        
        // Insert category relations
        if (categoryIds && categoryIds.length > 0) {
          await tx.insert(productCategories).values(
            categoryIds.map((categoryId, index) => ({
              productId: product.id,
              categoryId,
              position: index,
            }))
          );
        }
        
        ctx.logger.info({ productId: product.id }, "Product created");
        
        return product;
      });
    }),

  // Update product
  update: adminProcedure
    .input(updateProductInput)
    .mutation(async ({ ctx, input }) => {
      const { id, translations, categoryIds, ...productData } = input;
      
      return await ctx.db.transaction(async (tx) => {
        // Update product
        const [product] = await tx
          .update(products)
          .set({ ...productData, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();
        
        if (!product) {
          throw new Error("Product not found");
        }
        
        // Update translations if provided
        if (translations) {
          await tx.delete(productTranslations).where(eq(productTranslations.productId, id));
          if (translations.length > 0) {
            await tx.insert(productTranslations).values(
              translations.map((t) => ({
                productId: id,
                ...t,
              }))
            );
          }
        }
        
        // Update categories if provided
        if (categoryIds !== undefined) {
          await tx.delete(productCategories).where(eq(productCategories.productId, id));
          if (categoryIds.length > 0) {
            await tx.insert(productCategories).values(
              categoryIds.map((categoryId, index) => ({
                productId: id,
                categoryId,
                position: index,
              }))
            );
          }
        }
        
        ctx.logger.info({ productId: id }, "Product updated");
        
        return product;
      });
    }),

  // Delete product
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(products)
        .where(eq(products.id, input.id))
        .returning();
      
      if (!deleted) {
        throw new Error("Product not found");
      }
      
      ctx.logger.info({ productId: input.id }, "Product deleted");
      
      return { success: true };
    }),

  // Update stock
  updateStock: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      quantity: z.number().int(),
      operation: z.enum(["set", "add", "subtract"]).default("set"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, quantity, operation } = input;
      
      let newQuantity: number;
      
      if (operation === "set") {
        newQuantity = quantity;
      } else {
        const product = await ctx.db.query.products.findFirst({
          where: eq(products.id, id),
          columns: { stockQuantity: true },
        });
        
        if (!product) {
          throw new Error("Product not found");
        }
        
        newQuantity = operation === "add" 
          ? product.stockQuantity + quantity 
          : product.stockQuantity - quantity;
      }
      
      const [updated] = await ctx.db
        .update(products)
        .set({ stockQuantity: Math.max(0, newQuantity), updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      
      ctx.logger.info({ productId: id, newQuantity }, "Stock updated");
      
      return updated;
    }),
});

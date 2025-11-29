import { z } from "zod";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { router, adminProcedure } from "@/trpc/trpc";
import { categories, categoryTranslations } from "@/db/schema";

const createCategoryInput = z.object({
  slug: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
  translations: z.array(z.object({
    locale: z.string().max(10),
    name: z.string().max(255),
    description: z.string().optional(),
  })).min(1),
});

const updateCategoryInput = createCategoryInput.partial().extend({
  id: z.string().uuid(),
});

const listCategoriesInput = z.object({
  parentId: z.string().uuid().nullable().optional(),
  includeInactive: z.boolean().default(false),
  flat: z.boolean().default(false), // If true, return flat list; if false, return tree
});

export const categoryRouter = router({
  // List categories (optionally as tree)
  list: adminProcedure
    .input(listCategoriesInput)
    .query(async ({ ctx, input }) => {
      const { parentId, includeInactive, flat } = input;
      
      const conditions = [];
      if (!includeInactive) {
        conditions.push(eq(categories.isActive, true));
      }
      
      if (flat) {
        // Return flat list
        const items = await ctx.db.query.categories.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          with: {
            translations: true,
          },
          orderBy: [asc(categories.position), asc(categories.createdAt)],
        });
        return { items, type: "flat" as const };
      }
      
      // Return tree structure - fetch root categories
      if (parentId === undefined) {
        conditions.push(isNull(categories.parentId));
      } else if (parentId !== null) {
        conditions.push(eq(categories.parentId, parentId));
      }
      
      const items = await ctx.db.query.categories.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          translations: true,
        },
        orderBy: [asc(categories.position), asc(categories.createdAt)],
      });
      
      return { items, type: "tree" as const };
    }),

  // Get single category with children
  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.db.query.categories.findFirst({
        where: eq(categories.id, input.id),
        with: {
          translations: true,
        },
      });
      
      if (!category) {
        throw new Error("Category not found");
      }
      
      // Get children
      const children = await ctx.db.query.categories.findMany({
        where: eq(categories.parentId, input.id),
        with: {
          translations: true,
        },
        orderBy: [asc(categories.position)],
      });
      
      return { ...category, children };
    }),

  // Get by slug
  getBySlug: adminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.db.query.categories.findFirst({
        where: eq(categories.slug, input.slug),
        with: {
          translations: true,
        },
      });
      
      if (!category) {
        throw new Error("Category not found");
      }
      
      return category;
    }),

  // Create category
  create: adminProcedure
    .input(createCategoryInput)
    .mutation(async ({ ctx, input }) => {
      const { translations, ...categoryData } = input;
      
      return await ctx.db.transaction(async (tx) => {
        const [category] = await tx.insert(categories).values(categoryData).returning();
        
        if (translations.length > 0) {
          await tx.insert(categoryTranslations).values(
            translations.map((t) => ({
              categoryId: category.id,
              ...t,
            }))
          );
        }
        
        ctx.logger.info({ categoryId: category.id }, "Category created");
        
        return category;
      });
    }),

  // Update category
  update: adminProcedure
    .input(updateCategoryInput)
    .mutation(async ({ ctx, input }) => {
      const { id, translations, ...categoryData } = input;
      
      return await ctx.db.transaction(async (tx) => {
        const [category] = await tx
          .update(categories)
          .set({ ...categoryData, updatedAt: new Date() })
          .where(eq(categories.id, id))
          .returning();
        
        if (!category) {
          throw new Error("Category not found");
        }
        
        if (translations) {
          await tx.delete(categoryTranslations).where(eq(categoryTranslations.categoryId, id));
          if (translations.length > 0) {
            await tx.insert(categoryTranslations).values(
              translations.map((t) => ({
                categoryId: id,
                ...t,
              }))
            );
          }
        }
        
        ctx.logger.info({ categoryId: id }, "Category updated");
        
        return category;
      });
    }),

  // Delete category
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check for children
      const children = await ctx.db.query.categories.findFirst({
        where: eq(categories.parentId, input.id),
      });
      
      if (children) {
        throw new Error("Cannot delete category with children");
      }
      
      const [deleted] = await ctx.db
        .delete(categories)
        .where(eq(categories.id, input.id))
        .returning();
      
      if (!deleted) {
        throw new Error("Category not found");
      }
      
      ctx.logger.info({ categoryId: input.id }, "Category deleted");
      
      return { success: true };
    }),

  // Reorder categories
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
            .update(categories)
            .set({ position: item.position, updatedAt: new Date() })
            .where(eq(categories.id, item.id));
        }
      });
      
      ctx.logger.info({ count: input.items.length }, "Categories reordered");
      
      return { success: true };
    }),
});

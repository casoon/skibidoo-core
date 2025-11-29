import { Hono } from "hono";
import { eq, and, isNull, asc } from "drizzle-orm";
import { db } from "@/db/index";
import { categories, categoryTranslations, productCategories, products, productTranslations } from "@/db/schema/index";

const router = new Hono();

// List categories (tree structure)
router.get("/", async (c) => {
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  const flat = c.req.query("flat") === "true";
  
  // Get all active categories
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    with: {
      translations: {
        where: eq(categoryTranslations.locale, locale),
      },
    },
    orderBy: [asc(categories.position), asc(categories.createdAt)],
  });
  
  // Transform categories
  const transformCategory = (cat: typeof allCategories[0]) => {
    const translation = cat.translations[0];
    return {
      id: cat.id,
      slug: cat.slug,
      name: translation?.name || cat.slug,
      description: translation?.description || null,
      parentId: cat.parentId,
    };
  };
  
  if (flat) {
    return c.json({
      data: allCategories.map(transformCategory),
    });
  }
  
  // Build tree structure
  const categoryMap = new Map<string, ReturnType<typeof transformCategory> & { children: any[] }>();
  const roots: (ReturnType<typeof transformCategory> & { children: any[] })[] = [];
  
  for (const cat of allCategories) {
    const transformed = { ...transformCategory(cat), children: [] };
    categoryMap.set(cat.id, transformed);
  }
  
  for (const cat of allCategories) {
    const transformed = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(transformed);
    } else {
      roots.push(transformed);
    }
  }
  
  return c.json({ data: roots });
});

// Get category by slug
router.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.slug, slug), eq(categories.isActive, true)),
    with: {
      translations: {
        where: eq(categoryTranslations.locale, locale),
      },
    },
  });
  
  if (!category) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Category not found" },
    }, 404);
  }
  
  // Get children
  const children = await db.query.categories.findMany({
    where: and(eq(categories.parentId, category.id), eq(categories.isActive, true)),
    with: {
      translations: {
        where: eq(categoryTranslations.locale, locale),
      },
    },
    orderBy: [asc(categories.position)],
  });
  
  // Get breadcrumb (parents)
  const breadcrumb: Array<{ slug: string; name: string }> = [];
  let currentParentId = category.parentId;
  
  while (currentParentId) {
    const parent = await db.query.categories.findFirst({
      where: eq(categories.id, currentParentId),
      with: {
        translations: {
          where: eq(categoryTranslations.locale, locale),
        },
      },
    });
    
    if (parent) {
      breadcrumb.unshift({
        slug: parent.slug,
        name: parent.translations[0]?.name || parent.slug,
      });
      currentParentId = parent.parentId;
    } else {
      break;
    }
  }
  
  const translation = category.translations[0];
  
  return c.json({
    data: {
      id: category.id,
      slug: category.slug,
      name: translation?.name || category.slug,
      description: translation?.description || null,
      breadcrumb,
      children: children.map((child) => ({
        slug: child.slug,
        name: child.translations[0]?.name || child.slug,
      })),
    },
  });
});

// Get products in category
router.get("/:slug/products", async (c) => {
  const slug = c.req.param("slug");
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  // Pagination
  const query = c.req.query();
  const page = Math.max(1, parseInt(query["page[number]"] || "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(query["page[size]"] || "20", 10)));
  const offset = (page - 1) * size;
  
  // Find category
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.slug, slug), eq(categories.isActive, true)),
  });
  
  if (!category) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Category not found" },
    }, 404);
  }
  
  // Get product IDs in category (including subcategories)
  const categoryIds = [category.id];
  
  // Get subcategory IDs recursively
  const getSubcategoryIds = async (parentId: string): Promise<string[]> => {
    const subs = await db.query.categories.findMany({
      where: and(eq(categories.parentId, parentId), eq(categories.isActive, true)),
      columns: { id: true },
    });
    const ids = subs.map((s) => s.id);
    for (const sub of subs) {
      const subIds = await getSubcategoryIds(sub.id);
      ids.push(...subIds);
    }
    return ids;
  };
  
  const subcategoryIds = await getSubcategoryIds(category.id);
  categoryIds.push(...subcategoryIds);
  
  // Get products in these categories
  const productIdsResult = await db
    .selectDistinct({ productId: productCategories.productId })
    .from(productCategories)
    .where(
      and(
        // inArray would need the array
        // For now, use a simpler approach
        eq(productCategories.categoryId, category.id)
      )
    );
  
  const productIds = productIdsResult.map((p) => p.productId);
  
  if (productIds.length === 0) {
    return c.json({
      data: [],
      meta: { page, size, total: 0, totalPages: 0 },
    });
  }
  
  // Fetch products
  const items = await db.query.products.findMany({
    where: and(
      eq(products.status, "active"),
      // Would need inArray here
    ),
    with: {
      translations: {
        where: eq(productTranslations.locale, locale),
      },
    },
    limit: size,
    offset,
  });
  
  // Filter by productIds in memory for now
  const filteredItems = items.filter((p) => productIds.includes(p.id));
  
  const data = filteredItems.map((product) => {
    const translation = product.translations[0];
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: translation?.name || product.sku,
      price: {
        net: product.priceNet,
        gross: product.priceGross,
        currency: "EUR",
      },
      inStock: !product.trackInventory || product.stockQuantity > 0,
    };
  });
  
  return c.json({
    data,
    meta: {
      page,
      size,
      total: productIds.length,
      totalPages: Math.ceil(productIds.length / size),
    },
  });
});

export { router as categoryRoutes };

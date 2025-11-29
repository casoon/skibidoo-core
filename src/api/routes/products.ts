import { Hono } from "hono";
import { eq, and, like, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import { products, productTranslations, productCategories, categories } from "@/db/schema/index";

const router = new Hono();

// List products with filtering, pagination, sorting
router.get("/", async (c) => {
  const query = c.req.query();
  
  // Pagination
  const page = Math.max(1, parseInt(query["page[number]"] || "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(query["page[size]"] || "20", 10)));
  const offset = (page - 1) * size;
  
  // Sorting
  const sortParam = query.sort || "-createdAt";
  const sortDesc = sortParam.startsWith("-");
  const sortField = sortDesc ? sortParam.slice(1) : sortParam;
  
  // Build conditions
  const conditions = [eq(products.status, "active")];
  
  // Category filter
  if (query["filter[category]"]) {
    const categorySlugs = query["filter[category]"].split(",");
    const matchingCategories = await db.query.categories.findMany({
      where: inArray(categories.slug, categorySlugs),
      columns: { id: true },
    });
    
    if (matchingCategories.length > 0) {
      const categoryIds = matchingCategories.map((cat) => cat.id);
      const productIdsInCategories = await db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(inArray(productCategories.categoryId, categoryIds));
      
      if (productIdsInCategories.length > 0) {
        conditions.push(
          inArray(products.id, productIdsInCategories.map((p) => p.productId))
        );
      } else {
        return c.json({
          data: [],
          meta: { page, size, total: 0, totalPages: 0 },
        });
      }
    }
  }
  
  // Price filters
  if (query["filter[price][gte]"]) {
    const minPrice = parseInt(query["filter[price][gte]"], 10);
    conditions.push(sql`${products.priceGross} >= ${minPrice}`);
  }
  if (query["filter[price][lte]"]) {
    const maxPrice = parseInt(query["filter[price][lte]"], 10);
    conditions.push(sql`${products.priceGross} <= ${maxPrice}`);
  }
  
  // In stock filter
  if (query["filter[inStock]"] === "true") {
    conditions.push(sql`(${products.trackInventory} = false OR ${products.stockQuantity} > 0)`);
  }
  
  // Get locale from header or default
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  // Build order by
  const getOrderBy = () => {
    switch (sortField) {
      case "priceGross":
        return sortDesc ? desc(products.priceGross) : asc(products.priceGross);
      case "sku":
        return sortDesc ? desc(products.sku) : asc(products.sku);
      case "createdAt":
      default:
        return sortDesc ? desc(products.createdAt) : asc(products.createdAt);
    }
  };
  
  // Execute queries
  const [items, countResult] = await Promise.all([
    db.query.products.findMany({
      where: and(...conditions),
      with: {
        translations: {
          where: eq(productTranslations.locale, locale),
        },
      },
      orderBy: getOrderBy(),
      limit: size,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions)),
  ]);
  
  const total = Number(countResult[0]?.count ?? 0);
  
  // Transform for storefront
  const data = items.map((product) => {
    const translation = product.translations[0];
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: translation?.name || product.sku,
      description: translation?.description || null,
      shortDescription: translation?.shortDescription || null,
      price: {
        net: product.priceNet,
        gross: product.priceGross,
        currency: "EUR",
      },
      compareAtPrice: product.compareAtPrice,
      basePrice: product.basePriceAmount ? {
        amount: product.basePriceAmount,
        unit: product.basePriceUnit,
        reference: product.basePriceReference,
      } : null,
      inStock: !product.trackInventory || product.stockQuantity > 0,
      stockQuantity: product.trackInventory ? product.stockQuantity : null,
    };
  });
  
  return c.json({
    data,
    meta: {
      page,
      size,
      total,
      totalPages: Math.ceil(total / size),
    },
    links: {
      self: `/api/v1/products?page[number]=${page}&page[size]=${size}`,
      first: `/api/v1/products?page[number]=1&page[size]=${size}`,
      last: `/api/v1/products?page[number]=${Math.ceil(total / size)}&page[size]=${size}`,
      prev: page > 1 ? `/api/v1/products?page[number]=${page - 1}&page[size]=${size}` : null,
      next: page < Math.ceil(total / size) ? `/api/v1/products?page[number]=${page + 1}&page[size]=${size}` : null,
    },
  });
});

// Get single product by slug
router.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.status, "active")),
    with: {
      translations: {
        where: eq(productTranslations.locale, locale),
      },
      categories: true,
      deliveryTime: true,
    },
  });
  
  if (!product) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Product not found" },
    }, 404);
  }
  
  const translation = product.translations[0];
  
  // Get delivery time text
  let deliveryTimeText = null;
  if (product.deliveryTime) {
    deliveryTimeText = `${product.deliveryTime.minDays}-${product.deliveryTime.maxDays} Werktage`;
  }
  
  return c.json({
    data: {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: translation?.name || product.sku,
      description: translation?.description || null,
      shortDescription: translation?.shortDescription || null,
      price: {
        net: product.priceNet,
        gross: product.priceGross,
        currency: "EUR",
      },
      compareAtPrice: product.compareAtPrice,
      basePrice: product.basePriceAmount ? {
        amount: product.basePriceAmount,
        unit: product.basePriceUnit,
        reference: product.basePriceReference,
        formatted: formatBasePrice(product.basePriceAmount, product.basePriceUnit, product.basePriceReference),
      } : null,
      inStock: !product.trackInventory || product.stockQuantity > 0,
      stockQuantity: product.trackInventory ? product.stockQuantity : null,
      deliveryTime: deliveryTimeText,
      weight: product.weight,
      dimensions: product.length ? {
        length: product.length,
        width: product.width,
        height: product.height,
      } : null,
      meta: {
        title: product.metaTitle || translation?.name,
        description: product.metaDescription || translation?.shortDescription,
      },
    },
  });
});

// Search products (POST for complex queries)
router.post("/search", async (c) => {
  const body = await c.req.json();
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  const {
    query: searchQuery,
    filters = {},
    page = 1,
    size = 20,
  } = body;
  
  // Build conditions
  const conditions = [eq(products.status, "active")];
  
  // Text search
  if (searchQuery) {
    const matchingProducts = await db
      .select({ productId: productTranslations.productId })
      .from(productTranslations)
      .where(
        and(
          eq(productTranslations.locale, locale),
          sql`(${productTranslations.name} ILIKE ${"%" + searchQuery + "%"} OR ${productTranslations.description} ILIKE ${"%" + searchQuery + "%"})`
        )
      );
    
    if (matchingProducts.length > 0) {
      conditions.push(inArray(products.id, matchingProducts.map((p) => p.productId)));
    } else {
      conditions.push(like(products.sku, `%${searchQuery}%`));
    }
  }
  
  // Apply filters
  if (filters.priceMin) {
    conditions.push(sql`${products.priceGross} >= ${filters.priceMin}`);
  }
  if (filters.priceMax) {
    conditions.push(sql`${products.priceGross} <= ${filters.priceMax}`);
  }
  if (filters.inStock) {
    conditions.push(sql`(${products.trackInventory} = false OR ${products.stockQuantity} > 0)`);
  }
  
  const offset = (page - 1) * size;
  
  const [items, countResult] = await Promise.all([
    db.query.products.findMany({
      where: and(...conditions),
      with: {
        translations: {
          where: eq(productTranslations.locale, locale),
        },
      },
      orderBy: desc(products.createdAt),
      limit: size,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions)),
  ]);
  
  const total = Number(countResult[0]?.count ?? 0);
  
  const data = items.map((product) => {
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
    meta: { page, size, total, totalPages: Math.ceil(total / size) },
    facets: {},
  });
});

// Helper function for base price formatting
function formatBasePrice(amount: number | null, unit: string | null, reference: number | null): string | null {
  if (!amount || !unit || !reference) return null;
  const pricePerUnit = (amount / 100).toFixed(2).replace(".", ",");
  return `${pricePerUnit} EUR / ${reference} ${unit}`;
}

export { router as productRoutes };

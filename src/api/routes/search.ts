// Search API Routes
// src/api/routes/search.ts

import { Hono } from "hono";
import { searchService } from "@/search/search-service";

const router = new Hono();

// Full-text search endpoint
router.get("/", async (c) => {
  const query = c.req.query();
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";

  const searchQuery = query.q || query.query || "";
  
  if (!searchQuery || searchQuery.length < 2) {
    return c.json({
      data: [],
      meta: { page: 1, size: 20, total: 0, totalPages: 0 },
      message: "Suchbegriff muss mindestens 2 Zeichen haben",
    });
  }

  const page = Math.max(1, parseInt(query.page || "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(query.size || "20", 10)));

  // Parse filters
  const categoryIds = query.categories?.split(",").filter(Boolean);
  const priceMin = query.priceMin ? parseInt(query.priceMin, 10) : undefined;
  const priceMax = query.priceMax ? parseInt(query.priceMax, 10) : undefined;
  const inStock = query.inStock === "true";

  try {
    const result = await searchService.search({
      query: searchQuery,
      locale,
      categoryIds,
      priceMin,
      priceMax,
      inStock,
      page,
      size,
    });

    return c.json({
      data: result.results.map(r => ({
        id: r.id,
        slug: r.slug,
        sku: r.sku,
        name: r.name,
        description: r.description,
        price: {
          gross: r.price,
          currency: "EUR",
        },
        highlights: r.highlights,
        relevance: r.rank,
      })),
      meta: {
        page: result.page,
        size: result.size,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    // Fallback to simple search if full-text search fails
    const results = await searchService.simplSearch(searchQuery, locale, size);
    
    return c.json({
      data: results.map(r => ({
        id: r.id,
        slug: r.slug,
        sku: r.sku,
        name: r.name,
        description: r.description,
        price: {
          gross: r.price,
          currency: "EUR",
        },
      })),
      meta: {
        page: 1,
        size: results.length,
        total: results.length,
        totalPages: 1,
      },
    });
  }
});

// Autocomplete endpoint for search suggestions
router.get("/autocomplete", async (c) => {
  const query = c.req.query();
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";

  const searchQuery = query.q || "";
  const limit = Math.min(10, parseInt(query.limit || "5", 10));

  if (searchQuery.length < 2) {
    return c.json({ suggestions: [] });
  }

  const suggestions = await searchService.autocomplete(searchQuery, locale, limit);

  return c.json({ suggestions });
});

// Popular/trending searches
router.get("/suggestions", async (c) => {
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  const limit = Math.min(20, parseInt(c.req.query("limit") || "8", 10));

  const suggestions = await searchService.getSuggestions(locale, limit);

  return c.json({ suggestions });
});

export { router as searchRoutes };

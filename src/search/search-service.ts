// Full-Text Search Service
// src/search/search-service.ts

import { sql } from "drizzle-orm";
import { db } from "@/db/index";

export interface SearchResult {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  rank: number;
  highlights: {
    name?: string;
    description?: string;
  };
}

export interface SearchOptions {
  query: string;
  locale?: string;
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  page?: number;
  size?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  suggestions?: string[];
}

export const searchService = {
  // Full-text search with ranking
  async search(options: SearchOptions): Promise<SearchResponse> {
    const {
      query,
      locale = "de-DE",
      categoryIds,
      priceMin,
      priceMax,
      inStock,
      page = 1,
      size = 20,
    } = options;

    const offset = (page - 1) * size;
    const searchLang = locale.startsWith("de") ? "german" : "english";

    // Build the search query with ts_vector and ts_query
    const searchQuery = query
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 1)
      .map(word => word + ":*")
      .join(" & ");

    if (!searchQuery) {
      return { results: [], total: 0, page, size, totalPages: 0 };
    }

    // Build WHERE conditions
    const conditions: string[] = ["p.status = 'active'"];

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      const categoryList = categoryIds.map(id => "'" + id + "'").join(",");
      conditions.push("p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category_id IN (" + categoryList + "))");
    }

    // Price filters
    if (priceMin !== undefined) {
      conditions.push("p.price_gross >= " + priceMin);
    }
    if (priceMax !== undefined) {
      conditions.push("p.price_gross <= " + priceMax);
    }

    // Stock filter
    if (inStock) {
      conditions.push("(p.track_inventory = false OR p.stock_quantity > 0)");
    }

    const whereClause = conditions.join(" AND ");

    // Main search query with full-text search
    const searchSQL = sql.raw(`
      WITH search_results AS (
        SELECT
          p.id,
          p.slug,
          p.sku,
          p.price_gross as price,
          pt.name,
          pt.description,
          ts_rank(
            setweight(to_tsvector('${searchLang}', COALESCE(pt.name, '')), 'A') ||
            setweight(to_tsvector('${searchLang}', COALESCE(p.sku, '')), 'A') ||
            setweight(to_tsvector('${searchLang}', COALESCE(pt.short_description, '')), 'B') ||
            setweight(to_tsvector('${searchLang}', COALESCE(pt.description, '')), 'C'),
            to_tsquery('${searchLang}', '${searchQuery}')
          ) as rank,
          ts_headline('${searchLang}', COALESCE(pt.name, ''), to_tsquery('${searchLang}', '${searchQuery}'),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10') as name_highlight,
          ts_headline('${searchLang}', COALESCE(pt.description, ''), to_tsquery('${searchLang}', '${searchQuery}'),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10') as desc_highlight
        FROM products p
        LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = '${locale}'
        WHERE ${whereClause}
          AND (
            to_tsvector('${searchLang}', COALESCE(pt.name, '')) ||
            to_tsvector('${searchLang}', COALESCE(p.sku, '')) ||
            to_tsvector('${searchLang}', COALESCE(pt.description, ''))
          ) @@ to_tsquery('${searchLang}', '${searchQuery}')
        ORDER BY rank DESC
        LIMIT ${size} OFFSET ${offset}
      )
      SELECT * FROM search_results
    `);

    // Count query
    const countSQL = sql.raw(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = '${locale}'
      WHERE ${whereClause}
        AND (
          to_tsvector('${searchLang}', COALESCE(pt.name, '')) ||
          to_tsvector('${searchLang}', COALESCE(p.sku, '')) ||
          to_tsvector('${searchLang}', COALESCE(pt.description, ''))
        ) @@ to_tsquery('${searchLang}', '${searchQuery}')
    `);

    const [results, countResult] = await Promise.all([
      db.execute(searchSQL),
      db.execute(countSQL),
    ]);

    // db.execute returns array directly
    const countRow = (countResult as unknown[])[0] as { total: string } | undefined;
    const total = Number(countRow?.total ?? 0);

    const mappedResults: SearchResult[] = (results as unknown[]).map((row: unknown) => {
      const r = row as {
        id: string;
        slug: string;
        sku: string;
        name: string;
        description: string | null;
        price: number;
        rank: number;
        name_highlight: string;
        desc_highlight: string;
      };
      return {
        id: r.id,
        slug: r.slug,
        sku: r.sku,
        name: r.name,
        description: r.description,
        price: r.price,
        rank: r.rank,
        highlights: {
          name: r.name_highlight,
          description: r.desc_highlight,
        },
      };
    });

    return {
      results: mappedResults,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    };
  },

  // Simple ILIKE search fallback
  async simpleSearch(query: string, locale: string = "de-DE", limit: number = 10): Promise<SearchResult[]> {
    const searchPattern = "%" + query + "%";

    const results = await db.execute(sql`
      SELECT
        p.id,
        p.slug,
        p.sku,
        p.price_gross as price,
        pt.name,
        pt.description
      FROM products p
      LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ${locale}
      WHERE p.status = 'active'
        AND (
          pt.name ILIKE ${searchPattern}
          OR p.sku ILIKE ${searchPattern}
          OR pt.description ILIKE ${searchPattern}
        )
      ORDER BY
        CASE WHEN pt.name ILIKE ${searchPattern} THEN 0 ELSE 1 END,
        p.created_at DESC
      LIMIT ${limit}
    `);

    return (results as unknown[]).map((row: unknown) => {
      const r = row as {
        id: string;
        slug: string;
        sku: string;
        name: string;
        description: string | null;
        price: number;
      };
      return {
        id: r.id,
        slug: r.slug,
        sku: r.sku,
        name: r.name || r.sku,
        description: r.description,
        price: r.price,
        rank: 1,
        highlights: {},
      };
    });
  },

  // Autocomplete suggestions
  async autocomplete(query: string, locale: string = "de-DE", limit: number = 5): Promise<string[]> {
    if (query.length < 2) return [];

    const searchPattern = query + "%";

    const results = await db.execute(sql`
      SELECT DISTINCT pt.name
      FROM product_translations pt
      JOIN products p ON p.id = pt.product_id
      WHERE pt.locale = ${locale}
        AND p.status = 'active'
        AND pt.name ILIKE ${searchPattern}
      ORDER BY pt.name
      LIMIT ${limit}
    `);

    return (results as unknown[]).map((r) => (r as { name: string }).name);
  },

  // Get search suggestions based on popular searches or products
  async getSuggestions(locale: string = "de-DE", limit: number = 8): Promise<string[]> {
    const results = await db.execute(sql`
      SELECT pt.name
      FROM product_translations pt
      JOIN products p ON p.id = pt.product_id
      WHERE pt.locale = ${locale}
        AND p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `);

    return (results as unknown[]).map((r) => (r as { name: string }).name);
  },
};

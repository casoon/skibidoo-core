#!/usr/bin/env bun
/**
 * Seed demo products for development and testing.
 * Usage: bun run seed:products
 */

import { db } from "@/db";
import { products, productTranslations, categories, categoryTranslations } from "@/db/schema";

async function seedProducts() {
  console.log("Seeding demo products...");

  // Categories
  const demoCategories = [
    { slug: "kleidung", name: "Kleidung", nameEn: "Clothing" },
    { slug: "accessoires", name: "Accessoires", nameEn: "Accessories" },
    { slug: "schuhe", name: "Schuhe", nameEn: "Shoes" },
  ];

  const insertedCategories: Record<string, string> = {};
  for (const cat of demoCategories) {
    const existing = await db.query.categories.findFirst({
      where: (c, { eq }) => eq(c.slug, cat.slug),
    });
    if (!existing) {
      const [inserted] = await db.insert(categories).values({
        slug: cat.slug,
      }).returning();
      await db.insert(categoryTranslations).values([
        { categoryId: inserted.id, locale: "de", name: cat.name },
        { categoryId: inserted.id, locale: "en", name: cat.nameEn },
      ]);
      insertedCategories[cat.slug] = inserted.id;
      console.log(`Created category: ${cat.name}`);
    } else {
      insertedCategories[cat.slug] = existing.id;
      console.log(`Category already exists: ${cat.name}`);
    }
  }

  // Products
  const demoProducts = [
    {
      sku: "SKB-TEE-001",
      slug: "klassisches-t-shirt-weiss",
      type: "simple" as const,
      status: "active" as const,
      priceNet: 1597,   // 15.97 € net
      priceGross: 1900, // 19.00 € gross (19% VAT)
      stockQuantity: 100,
      weight: 200,
      translations: {
        de: { name: "Klassisches T-Shirt Weiß", description: "Ein zeitloses weißes T-Shirt aus 100% Bio-Baumwolle." },
        en: { name: "Classic White T-Shirt", description: "A timeless white T-shirt made from 100% organic cotton." },
      },
    },
    {
      sku: "SKB-JKT-001",
      slug: "denim-jacke-blau",
      type: "simple" as const,
      status: "active" as const,
      priceNet: 5042,    // 50.42 € net
      priceGross: 5999,  // 59.99 € gross
      compareAtPrice: 7999,
      stockQuantity: 25,
      weight: 800,
      translations: {
        de: { name: "Denim-Jacke Blau", description: "Klassische Denim-Jacke in mittlerer Waschung, zeitloser Schnitt." },
        en: { name: "Blue Denim Jacket", description: "Classic denim jacket in mid wash, timeless cut." },
      },
    },
    {
      sku: "SKB-BAG-001",
      slug: "leder-tasche-schwarz",
      type: "simple" as const,
      status: "active" as const,
      priceNet: 10084,   // 100.84 € net
      priceGross: 11999, // 119.99 € gross
      stockQuantity: 15,
      weight: 600,
      translations: {
        de: { name: "Ledertasche Schwarz", description: "Hochwertige Ledertasche mit mehreren Fächern, handgefertigt." },
        en: { name: "Black Leather Bag", description: "Premium leather bag with multiple compartments, handcrafted." },
      },
    },
    {
      sku: "SKB-SNK-001",
      slug: "sneaker-weiss-42",
      type: "simple" as const,
      status: "active" as const,
      priceNet: 6722,   // 67.22 € net
      priceGross: 7999, // 79.99 € gross
      stockQuantity: 30,
      weight: 700,
      translations: {
        de: { name: "Sneaker Weiß", description: "Leichte Sneaker für den Alltag, pflegeleichtes Material." },
        en: { name: "White Sneakers", description: "Lightweight everyday sneakers, easy-care material." },
      },
    },
    {
      sku: "SKB-CAP-001",
      slug: "baseball-cap-schwarz",
      type: "simple" as const,
      status: "active" as const,
      priceNet: 2101,  // 21.01 € net
      priceGross: 2499, // 24.99 € gross
      stockQuantity: 50,
      weight: 150,
      translations: {
        de: { name: "Baseball Cap Schwarz", description: "Strukturierte Baseball Cap mit verstellbarem Verschluss." },
        en: { name: "Black Baseball Cap", description: "Structured baseball cap with adjustable closure." },
      },
    },
  ];

  for (const product of demoProducts) {
    const existing = await db.query.products.findFirst({
      where: (p, { eq }) => eq(p.sku, product.sku),
    });

    if (existing) {
      console.log(`Product already exists: ${product.sku}`);
      continue;
    }

    const { translations, ...productData } = product;
    const [inserted] = await db.insert(products).values(productData).returning();

    for (const [locale, translation] of Object.entries(translations)) {
      await db.insert(productTranslations).values({
        productId: inserted.id,
        locale,
        name: translation.name,
        description: translation.description,
      });
    }

    console.log(`Created product: ${product.sku} – ${translations.de.name}`);
  }

  console.log("Product seeding complete.");
}

seedProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

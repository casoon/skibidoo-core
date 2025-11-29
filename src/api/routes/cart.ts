import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { carts, cartItems, products, productTranslations } from "../../db/schema/index.js";

const router = new Hono();

// Create new cart
router.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = body.sessionId || crypto.randomUUID();
  
  // Set expiry to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  const [cart] = await db.insert(carts).values({
    sessionId,
    currency: "EUR",
    expiresAt,
  }).returning();
  
  return c.json({
    data: {
      id: cart.id,
      sessionId: cart.sessionId,
      items: [],
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      currency: cart.currency,
      itemCount: 0,
    },
  }, 201);
});

// Get cart by ID
router.get("/:id", async (c) => {
  const id = c.req.param("id");
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, id),
    with: {
      items: {
        with: {
          product: {
            with: {
              translations: {
                where: eq(productTranslations.locale, locale),
              },
            },
          },
        },
      },
    },
  });
  
  if (!cart) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart not found" },
    }, 404);
  }
  
  // Check if expired
  if (cart.expiresAt && cart.expiresAt < new Date()) {
    return c.json({
      error: { code: "CART_EXPIRED", message: "Cart has expired" },
    }, 410);
  }
  
  // Transform items
  const items = cart.items.map((item) => {
    const translation = item.product?.translations[0];
    return {
      id: item.id,
      productId: item.productId,
      slug: item.product?.slug,
      sku: item.product?.sku,
      name: translation?.name || item.product?.sku || "Unknown",
      quantity: item.quantity,
      unitPrice: {
        net: item.unitPriceNet,
        gross: item.unitPriceGross,
      },
      totalPrice: {
        net: item.unitPriceNet * item.quantity,
        gross: item.unitPriceGross * item.quantity,
      },
      inStock: item.product ? (!item.product.trackInventory || item.product.stockQuantity >= item.quantity) : false,
    };
  });
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return c.json({
    data: {
      id: cart.id,
      sessionId: cart.sessionId,
      items,
      subtotal: cart.subtotal,
      taxTotal: cart.taxTotal,
      total: cart.total,
      currency: cart.currency,
      itemCount,
    },
  });
});

// Add item to cart
router.post("/:id/items", async (c) => {
  const cartId = c.req.param("id");
  const body = await c.req.json();
  const { productId, quantity = 1 } = body;
  
  if (!productId) {
    return c.json({
      error: { code: "INVALID_INPUT", message: "productId is required" },
    }, 400);
  }
  
  // Check cart exists
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
  });
  
  if (!cart) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart not found" },
    }, 404);
  }
  
  // Check product exists and is active
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.status, "active")),
  });
  
  if (!product) {
    return c.json({
      error: { code: "PRODUCT_NOT_FOUND", message: "Product not found or not available" },
    }, 404);
  }
  
  // Check stock
  if (product.trackInventory && product.stockQuantity < quantity) {
    return c.json({
      error: { 
        code: "INSUFFICIENT_STOCK", 
        message: "Not enough stock available",
        available: product.stockQuantity,
      },
    }, 400);
  }
  
  // Check if item already in cart
  const existingItem = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
  });
  
  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;
    
    // Check stock for new quantity
    if (product.trackInventory && product.stockQuantity < newQuantity) {
      return c.json({
        error: { 
          code: "INSUFFICIENT_STOCK", 
          message: "Not enough stock available",
          available: product.stockQuantity,
        },
      }, 400);
    }
    
    await db
      .update(cartItems)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    // Add new item
    await db.insert(cartItems).values({
      cartId,
      productId,
      quantity,
      unitPriceNet: product.priceNet,
      unitPriceGross: product.priceGross,
    });
  }
  
  // Recalculate cart totals
  await recalculateCart(cartId);
  
  // Return updated cart
  return getCartResponse(c, cartId);
});

// Update item quantity
router.patch("/:id/items/:itemId", async (c) => {
  const cartId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const body = await c.req.json();
  const { quantity } = body;
  
  if (typeof quantity !== "number" || quantity < 0) {
    return c.json({
      error: { code: "INVALID_INPUT", message: "quantity must be a non-negative number" },
    }, 400);
  }
  
  // Get item
  const item = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)),
    with: {
      product: true,
    },
  });
  
  if (!item) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart item not found" },
    }, 404);
  }
  
  if (quantity === 0) {
    // Remove item
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
  } else {
    // Check stock
    if (item.product?.trackInventory && item.product.stockQuantity < quantity) {
      return c.json({
        error: { 
          code: "INSUFFICIENT_STOCK", 
          message: "Not enough stock available",
          available: item.product.stockQuantity,
        },
      }, 400);
    }
    
    // Update quantity
    await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, itemId));
  }
  
  // Recalculate cart totals
  await recalculateCart(cartId);
  
  // Return updated cart
  return getCartResponse(c, cartId);
});

// Remove item from cart
router.delete("/:id/items/:itemId", async (c) => {
  const cartId = c.req.param("id");
  const itemId = c.req.param("itemId");
  
  const deleted = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .returning();
  
  if (deleted.length === 0) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart item not found" },
    }, 404);
  }
  
  // Recalculate cart totals
  await recalculateCart(cartId);
  
  // Return updated cart
  return getCartResponse(c, cartId);
});

// Clear cart
router.delete("/:id", async (c) => {
  const cartId = c.req.param("id");
  
  // Delete all items
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  
  // Reset totals
  await db
    .update(carts)
    .set({ subtotal: 0, taxTotal: 0, total: 0, updatedAt: new Date() })
    .where(eq(carts.id, cartId));
  
  return c.json({ data: { success: true } });
});

// Helper: Recalculate cart totals
async function recalculateCart(cartId: string) {
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.cartId, cartId),
  });
  
  let subtotal = 0;
  let taxTotal = 0;
  
  for (const item of items) {
    const lineTotal = item.unitPriceGross * item.quantity;
    const lineTax = (item.unitPriceGross - item.unitPriceNet) * item.quantity;
    subtotal += lineTotal;
    taxTotal += lineTax;
  }
  
  await db
    .update(carts)
    .set({ 
      subtotal, 
      taxTotal, 
      total: subtotal, 
      updatedAt: new Date() 
    })
    .where(eq(carts.id, cartId));
}

// Helper: Get cart response
async function getCartResponse(c: any, cartId: string) {
  const locale = c.req.header("Accept-Language")?.split(",")[0] || "de-DE";
  
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        with: {
          product: {
            with: {
              translations: {
                where: eq(productTranslations.locale, locale),
              },
            },
          },
        },
      },
    },
  });
  
  if (!cart) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart not found" },
    }, 404);
  }
  
  const items = cart.items.map((item) => {
    const translation = item.product?.translations[0];
    return {
      id: item.id,
      productId: item.productId,
      slug: item.product?.slug,
      name: translation?.name || item.product?.sku || "Unknown",
      quantity: item.quantity,
      unitPrice: {
        net: item.unitPriceNet,
        gross: item.unitPriceGross,
      },
      totalPrice: {
        net: item.unitPriceNet * item.quantity,
        gross: item.unitPriceGross * item.quantity,
      },
    };
  });
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return c.json({
    data: {
      id: cart.id,
      items,
      subtotal: cart.subtotal,
      taxTotal: cart.taxTotal,
      total: cart.total,
      currency: cart.currency,
      itemCount,
    },
  });
}

export { router as cartRoutes };

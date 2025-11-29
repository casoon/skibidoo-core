import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/index";
import { carts, cartItems, orders, orderItems, orderTaxLines, products, shippingMethods, paymentMethods, coupons } from "@/db/schema/index";

const router = new Hono();

// Create checkout session from cart
router.post("/", async (c) => {
  const body = await c.req.json();
  const { cartId, email, shippingAddress, billingAddress } = body;
  
  if (!cartId) {
    return c.json({
      error: { code: "INVALID_INPUT", message: "cartId is required" },
    }, 400);
  }
  
  // Get cart with items
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });
  
  if (!cart) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart not found" },
    }, 404);
  }
  
  if (cart.items.length === 0) {
    return c.json({
      error: { code: "EMPTY_CART", message: "Cart is empty" },
    }, 400);
  }
  
  // Check stock for all items
  const stockIssues = [];
  for (const item of cart.items) {
    if (item.product?.trackInventory && item.product.stockQuantity < item.quantity) {
      stockIssues.push({
        productId: item.productId,
        sku: item.product.sku,
        requested: item.quantity,
        available: item.product.stockQuantity,
      });
    }
  }
  
  if (stockIssues.length > 0) {
    return c.json({
      error: { 
        code: "INSUFFICIENT_STOCK", 
        message: "Some items are out of stock",
        items: stockIssues,
      },
    }, 400);
  }
  
  // Get available shipping methods
  const availableShipping = await db.query.shippingMethods.findMany({
    where: eq(shippingMethods.isActive, true),
  });
  
  // Get available payment methods
  const availablePayment = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.isActive, true),
  });
  
  // Return checkout session data
  return c.json({
    data: {
      cartId: cart.id,
      items: cart.items.map((item) => ({
        productId: item.productId,
        sku: item.product?.sku,
        quantity: item.quantity,
        unitPrice: item.unitPriceGross,
        total: item.unitPriceGross * item.quantity,
      })),
      subtotal: cart.subtotal,
      taxTotal: cart.taxTotal,
      total: cart.total,
      currency: cart.currency,
      shippingMethods: availableShipping.map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        description: m.description,
        price: m.price,
        freeAbove: m.freeAbove,
      })),
      paymentMethods: availablePayment.map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        description: m.description,
      })),
      requiresAddress: true,
      requiresEmail: true,
    },
  }, 201);
});

// Apply coupon
router.post("/coupon", async (c) => {
  const body = await c.req.json();
  const { cartId, code } = body;
  
  if (!code) {
    return c.json({
      error: { code: "INVALID_INPUT", message: "code is required" },
    }, 400);
  }
  
  // Get cart
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
  });
  
  if (!cart) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Cart not found" },
    }, 404);
  }
  
  // Find coupon
  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.code, code.toUpperCase()),
  });
  
  if (!coupon) {
    return c.json({
      error: { code: "INVALID_COUPON", message: "Coupon not found" },
    }, 400);
  }
  
  if (!coupon.isActive) {
    return c.json({
      error: { code: "INVALID_COUPON", message: "Coupon is not active" },
    }, 400);
  }
  
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return c.json({
      error: { code: "INVALID_COUPON", message: "Coupon is not yet valid" },
    }, 400);
  }
  
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return c.json({
      error: { code: "INVALID_COUPON", message: "Coupon has expired" },
    }, 400);
  }
  
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return c.json({
      error: { code: "INVALID_COUPON", message: "Coupon usage limit reached" },
    }, 400);
  }
  
  if (coupon.minPurchase && cart.subtotal < coupon.minPurchase) {
    return c.json({
      error: { 
        code: "MIN_PURCHASE_NOT_MET", 
        message: `Minimum purchase of ${(coupon.minPurchase / 100).toFixed(2)} EUR required`,
      },
    }, 400);
  }
  
  // Calculate discount
  let discount = 0;
  if (coupon.type === "percentage") {
    discount = Math.floor(cart.subtotal * coupon.value / 10000);
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else if (coupon.type === "fixed") {
    discount = Math.min(coupon.value, cart.subtotal);
  }
  
  return c.json({
    data: {
      code: coupon.code,
      type: coupon.type,
      discount,
      newTotal: cart.total - discount,
    },
  });
});

// Complete checkout / place order
router.post("/complete", async (c) => {
  const body = await c.req.json();
  const {
    cartId,
    email,
    shippingAddress,
    billingAddress,
    shippingMethodId,
    paymentMethodId,
    couponCode,
    acceptedTerms,
    acceptedCancellationPolicy,
    customerNote,
  } = body;
  
  // Validate required fields
  if (!cartId || !email || !shippingAddress || !billingAddress) {
    return c.json({
      error: { code: "INVALID_INPUT", message: "Missing required fields" },
    }, 400);
  }
  
  // German legal requirements
  if (!acceptedTerms) {
    return c.json({
      error: { code: "TERMS_NOT_ACCEPTED", message: "Terms and conditions must be accepted" },
    }, 400);
  }
  
  if (!acceptedCancellationPolicy) {
    return c.json({
      error: { code: "CANCELLATION_POLICY_NOT_ACCEPTED", message: "Cancellation policy must be accepted" },
    }, 400);
  }
  
  // Get cart with items
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });
  
  if (!cart || cart.items.length === 0) {
    return c.json({
      error: { code: "INVALID_CART", message: "Cart not found or empty" },
    }, 400);
  }
  
  // Get shipping method
  let shippingTotal = 0;
  if (shippingMethodId) {
    const shippingMethod = await db.query.shippingMethods.findFirst({
      where: eq(shippingMethods.id, shippingMethodId),
    });
    if (shippingMethod) {
      shippingTotal = shippingMethod.price;
      // Check for free shipping threshold
      if (shippingMethod.freeAbove && cart.subtotal >= shippingMethod.freeAbove) {
        shippingTotal = 0;
      }
    }
  }
  
  // Calculate discount
  let discountTotal = 0;
  if (couponCode) {
    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, couponCode.toUpperCase()),
    });
    if (coupon && coupon.isActive) {
      if (coupon.type === "percentage") {
        discountTotal = Math.floor(cart.subtotal * coupon.value / 10000);
        if (coupon.maxDiscount && discountTotal > coupon.maxDiscount) {
          discountTotal = coupon.maxDiscount;
        }
      } else if (coupon.type === "fixed") {
        discountTotal = Math.min(coupon.value, cart.subtotal);
      }
      
      // Increment usage
      await db
        .update(coupons)
        .set({ usageCount: coupon.usageCount + 1, updatedAt: new Date() })
        .where(eq(coupons.id, coupon.id));
    }
  }
  
  // Calculate totals
  const subtotal = cart.subtotal;
  const taxTotal = cart.taxTotal;
  const total = subtotal + shippingTotal - discountTotal;
  
  // Generate order number
  const year = new Date().getFullYear();
  const lastOrder = await db.query.orders.findFirst({
    orderBy: desc(orders.createdAt),
    columns: { orderNumber: true },
  });
  
  let nextNumber = 1;
  if (lastOrder?.orderNumber) {
    const match = lastOrder.orderNumber.match(/SK-(\d{4})-(\d+)/);
    if (match && match[1] === String(year)) {
      nextNumber = parseInt(match[2], 10) + 1;
    }
  }
  const orderNumber = `SK-${year}-${String(nextNumber).padStart(6, "0")}`;
  
  // Create order in transaction
  const order = await db.transaction(async (tx) => {
    // Create order
    const [newOrder] = await tx.insert(orders).values({
      orderNumber,
      email,
      phone: shippingAddress.phone || billingAddress.phone,
      billingAddress,
      shippingAddress,
      subtotal,
      shippingTotal,
      taxTotal,
      discountTotal,
      total,
      currency: cart.currency,
      shippingMethodId,
      paymentMethodId,
      acceptedTerms: true,
      acceptedTermsAt: new Date(),
      acceptedCancellationPolicy: true,
      customerNote,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    }).returning();
    
    // Create order items
    for (const item of cart.items) {
      const taxRate = item.product ? Math.round((item.unitPriceGross - item.unitPriceNet) / item.unitPriceNet * 10000) : 1900;
      const totalNet = item.unitPriceNet * item.quantity;
      const totalGross = item.unitPriceGross * item.quantity;
      const taxAmount = totalGross - totalNet;
      
      await tx.insert(orderItems).values({
        orderId: newOrder.id,
        productId: item.productId,
        sku: item.product?.sku || "UNKNOWN",
        name: item.product?.sku || "Unknown Product", // Would get from translations
        quantity: item.quantity,
        unitPriceNet: item.unitPriceNet,
        unitPriceGross: item.unitPriceGross,
        totalNet,
        totalGross,
        taxRate,
        taxAmount,
      });
      
      // Reduce stock
      if (item.product?.trackInventory) {
        await tx
          .update(products)
          .set({ 
            stockQuantity: item.product.stockQuantity - item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }
    }
    
    // Add tax lines (simplified - single tax rate for now)
    await tx.insert(orderTaxLines).values({
      orderId: newOrder.id,
      name: "MwSt. 19%",
      rate: 1900,
      amount: taxTotal,
    });
    
    // Clear cart
    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
    await tx
      .update(carts)
      .set({ subtotal: 0, taxTotal: 0, total: 0, updatedAt: new Date() })
      .where(eq(carts.id, cartId));
    
    return newOrder;
  });
  
  return c.json({
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      currency: order.currency,
      // Payment redirect would go here
      nextStep: paymentMethodId ? "payment" : "confirmation",
    },
  }, 201);
});

// Get order status (for confirmation page)
router.get("/order/:orderNumber", async (c) => {
  const orderNumber = c.req.param("orderNumber");
  const email = c.req.query("email");
  
  if (!email) {
    return c.json({
      error: { code: "INVALID_INPUT", message: "email query parameter required" },
    }, 400);
  }
  
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.orderNumber, orderNumber),
      eq(orders.email, email)
    ),
    with: {
      items: true,
    },
  });
  
  if (!order) {
    return c.json({
      error: { code: "NOT_FOUND", message: "Order not found" },
    }, 404);
  }
  
  return c.json({
    data: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      items: order.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        total: item.totalGross,
      })),
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      total: order.total,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
    },
  });
});

export { router as checkoutRoutes };

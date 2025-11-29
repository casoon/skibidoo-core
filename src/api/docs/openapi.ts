// OpenAPI Documentation
// src/api/docs/openapi.ts

import { swaggerUI } from "@hono/swagger-ui";
import type { Hono } from "hono";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Skibidoo Commerce API",
    version: "0.1.0",
    description: "REST API for Skibidoo E-Commerce Platform",
    contact: {
      name: "Casoon",
      url: "https://casoon.de",
    },
    license: {
      name: "LGPL-3.0",
      url: "https://www.gnu.org/licenses/lgpl-3.0.html",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
    {
      url: "https://api.skibidoo.shop",
      description: "Production server",
    },
  ],
  tags: [
    { name: "Products", description: "Product management" },
    { name: "Categories", description: "Category management" },
    { name: "Cart", description: "Shopping cart operations" },
    { name: "Orders", description: "Order management" },
    { name: "Customers", description: "Customer management" },
    { name: "Inventory", description: "Stock management" },
    { name: "Discounts", description: "Discount codes" },
    { name: "Currency", description: "Multi-currency support" },
    { name: "Webhooks", description: "Webhook management" },
    { name: "Auth", description: "Authentication" },
  ],
  paths: {
    // Products
    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "List all products",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "List of products",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductList" },
              },
            },
          },
        },
      },
    },
    "/api/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get product by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Product details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Product" },
              },
            },
          },
          "404": { description: "Product not found" },
        },
      },
    },

    // Cart
    "/api/cart": {
      get: {
        tags: ["Cart"],
        summary: "Get current cart",
        security: [{ sessionToken: [] }],
        responses: {
          "200": {
            description: "Cart contents",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Cart" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Cart"],
        summary: "Add item to cart",
        security: [{ sessionToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddToCartInput" },
            },
          },
        },
        responses: {
          "200": { description: "Item added to cart" },
        },
      },
    },

    // Orders
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "List customer orders",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of orders",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderList" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create new order",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateOrderInput" },
            },
          },
        },
        responses: {
          "201": { description: "Order created" },
        },
      },
    },

    // Inventory
    "/api/inventory/{productId}": {
      get: {
        tags: ["Inventory"],
        summary: "Get product inventory",
        parameters: [
          { name: "productId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Inventory details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InventoryItem" },
              },
            },
          },
        },
      },
    },
    "/api/inventory/{productId}/reserve": {
      post: {
        tags: ["Inventory"],
        summary: "Reserve stock for order",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "productId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReserveStockInput" },
            },
          },
        },
        responses: {
          "200": { description: "Stock reserved" },
          "400": { description: "Insufficient stock" },
        },
      },
    },

    // Discounts
    "/api/discounts/validate": {
      post: {
        tags: ["Discounts"],
        summary: "Validate discount code",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApplyDiscountInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Discount validation result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DiscountResult" },
              },
            },
          },
        },
      },
    },

    // Currency
    "/api/currency": {
      get: {
        tags: ["Currency"],
        summary: "List available currencies",
        responses: {
          "200": {
            description: "List of currencies",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Currency" },
                },
              },
            },
          },
        },
      },
    },
    "/api/currency/convert": {
      post: {
        tags: ["Currency"],
        summary: "Convert amount between currencies",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  from: { type: "string" },
                  to: { type: "string" },
                },
                required: ["amount", "from", "to"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Conversion result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PriceConversion" },
              },
            },
          },
        },
      },
    },

    // Webhooks
    "/api/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook endpoints",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of webhooks",
          },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Register webhook endpoint",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateWebhookInput" },
            },
          },
        },
        responses: {
          "201": { description: "Webhook created" },
        },
      },
    },

    // Auth
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Customer login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Customer registration",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterInput" },
            },
          },
        },
        responses: {
          "201": { description: "Registration successful" },
          "400": { description: "Validation error" },
        },
      },
    },
  },
  components: {
    schemas: {
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          compareAtPrice: { type: "number" },
          images: { type: "array", items: { type: "string" } },
          categoryId: { type: "string" },
          variants: { type: "array", items: { $ref: "#/components/schemas/ProductVariant" } },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ProductVariant: {
        type: "object",
        properties: {
          id: { type: "string" },
          sku: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          options: { type: "object" },
        },
      },
      ProductList: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/Product" } },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
        },
      },
      Cart: {
        type: "object",
        properties: {
          id: { type: "string" },
          items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
          subtotal: { type: "number" },
          shipping: { type: "number" },
          tax: { type: "number" },
          total: { type: "number" },
          discountCode: { type: "string" },
          discountAmount: { type: "number" },
        },
      },
      CartItem: {
        type: "object",
        properties: {
          productId: { type: "string" },
          variantId: { type: "string" },
          quantity: { type: "integer" },
          unitPrice: { type: "number" },
          totalPrice: { type: "number" },
        },
      },
      AddToCartInput: {
        type: "object",
        properties: {
          productId: { type: "string" },
          variantId: { type: "string" },
          quantity: { type: "integer", default: 1 },
        },
        required: ["productId"],
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          orderNumber: { type: "string" },
          status: { type: "string", enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled"] },
          items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
          subtotal: { type: "number" },
          shipping: { type: "number" },
          tax: { type: "number" },
          total: { type: "number" },
          shippingAddress: { $ref: "#/components/schemas/Address" },
          billingAddress: { $ref: "#/components/schemas/Address" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      OrderList: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/Order" } },
          total: { type: "integer" },
        },
      },
      CreateOrderInput: {
        type: "object",
        properties: {
          shippingAddress: { $ref: "#/components/schemas/Address" },
          billingAddress: { $ref: "#/components/schemas/Address" },
          paymentMethod: { type: "string" },
          shippingMethod: { type: "string" },
        },
        required: ["shippingAddress", "paymentMethod"],
      },
      Address: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          company: { type: "string" },
          street: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          country: { type: "string" },
          phone: { type: "string" },
        },
        required: ["firstName", "lastName", "street", "city", "postalCode", "country"],
      },
      InventoryItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          variantId: { type: "string" },
          sku: { type: "string" },
          quantity: { type: "integer" },
          reservedQuantity: { type: "integer" },
          availableQuantity: { type: "integer" },
          lowStockThreshold: { type: "integer" },
          trackInventory: { type: "boolean" },
          allowBackorder: { type: "boolean" },
        },
      },
      ReserveStockInput: {
        type: "object",
        properties: {
          quantity: { type: "integer" },
          orderId: { type: "string" },
          expiresInMinutes: { type: "integer", default: 30 },
        },
        required: ["quantity", "orderId"],
      },
      ApplyDiscountInput: {
        type: "object",
        properties: {
          code: { type: "string" },
          cartTotal: { type: "number" },
          cartItems: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
          customerId: { type: "string" },
          isFirstOrder: { type: "boolean" },
        },
        required: ["code", "cartTotal", "cartItems"],
      },
      DiscountResult: {
        type: "object",
        properties: {
          valid: { type: "boolean" },
          discountAmount: { type: "number" },
          discountedTotal: { type: "number" },
          message: { type: "string" },
        },
      },
      Currency: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          symbol: { type: "string" },
          exchangeRate: { type: "number" },
          isDefault: { type: "boolean" },
          isActive: { type: "boolean" },
        },
      },
      PriceConversion: {
        type: "object",
        properties: {
          originalAmount: { type: "number" },
          originalCurrency: { type: "string" },
          convertedAmount: { type: "number" },
          targetCurrency: { type: "string" },
          exchangeRate: { type: "number" },
          formattedOriginal: { type: "string" },
          formattedConverted: { type: "string" },
        },
      },
      CreateWebhookInput: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          secret: { type: "string" },
          active: { type: "boolean", default: true },
        },
        required: ["url", "events"],
      },
      RegisterInput: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          firstName: { type: "string" },
          lastName: { type: "string" },
          acceptTerms: { type: "boolean" },
        },
        required: ["email", "password", "firstName", "lastName", "acceptTerms"],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      sessionToken: {
        type: "apiKey",
        in: "cookie",
        name: "session",
      },
    },
  },
};

export function setupSwaggerUI(app: Hono) {
  // Serve OpenAPI spec as JSON
  app.get("/api/docs/openapi.json", (c) => {
    return c.json(openApiSpec);
  });

  // Serve Swagger UI
  app.get(
    "/api/docs",
    swaggerUI({
      url: "/api/docs/openapi.json",
    })
  );
}

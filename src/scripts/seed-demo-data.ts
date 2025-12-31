import { db } from "../db";
import { orders, orderItems, coupons } from "../db/schema";

async function seedDemoData() {
  console.log("Seeding demo data...");

  const products = await db.query.products.findMany({
    with: { translations: true }
  });
  
  if (products.length === 0) {
    console.log("No products found!");
    return;
  }

  console.log(`Found ${products.length} products`);

  const demoOrders = [
    { orderNumber: "SKB-2024-0001", email: "max.mustermann@example.de", status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "shipped", subtotal: 9900, shippingTotal: 499, taxTotal: 1581, total: 11980, billingAddress: { firstName: "Max", lastName: "Mustermann", street: "Musterstraße", streetNumber: "123", city: "Berlin", postalCode: "10115", country: "DE" }, shippingAddress: { firstName: "Max", lastName: "Mustermann", street: "Musterstraße", streetNumber: "123", city: "Berlin", postalCode: "10115", country: "DE" }, acceptedTerms: true, acceptedCancellationPolicy: true, trackingNumber: "DE123456789" },
    { orderNumber: "SKB-2024-0002", email: "anna.schmidt@example.de", status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "delivered", subtotal: 19900, shippingTotal: 0, taxTotal: 3181, total: 23081, billingAddress: { firstName: "Anna", lastName: "Schmidt", street: "Hauptstraße", streetNumber: "45", city: "München", postalCode: "80331", country: "DE" }, shippingAddress: { firstName: "Anna", lastName: "Schmidt", street: "Hauptstraße", streetNumber: "45", city: "München", postalCode: "80331", country: "DE" }, acceptedTerms: true, acceptedCancellationPolicy: true },
    { orderNumber: "SKB-2024-0003", email: "tom.weber@example.de", status: "pending", paymentStatus: "pending", fulfillmentStatus: "unfulfilled", subtotal: 8800, shippingTotal: 499, taxTotal: 1406, total: 10705, billingAddress: { firstName: "Tom", lastName: "Weber", street: "Gartenweg", streetNumber: "7", city: "Hamburg", postalCode: "20095", country: "DE" }, shippingAddress: { firstName: "Tom", lastName: "Weber", street: "Gartenweg", streetNumber: "7", city: "Hamburg", postalCode: "20095", country: "DE" }, acceptedTerms: true, acceptedCancellationPolicy: true },
    { orderNumber: "SKB-2024-0004", email: "lisa.mueller@example.de", status: "confirmed", paymentStatus: "paid", fulfillmentStatus: "processing", subtotal: 29800, shippingTotal: 0, taxTotal: 4761, total: 34561, billingAddress: { firstName: "Lisa", lastName: "Müller", street: "Schlossallee", streetNumber: "1", city: "Frankfurt", postalCode: "60311", country: "DE" }, shippingAddress: { firstName: "Lisa", lastName: "Müller", street: "Schlossallee", streetNumber: "1", city: "Frankfurt", postalCode: "60311", country: "DE" }, acceptedTerms: true, acceptedCancellationPolicy: true },
    { orderNumber: "SKB-2024-0005", email: "peter.braun@example.de", status: "cancelled", paymentStatus: "refunded", fulfillmentStatus: "unfulfilled", subtotal: 5900, shippingTotal: 499, taxTotal: 943, total: 7342, billingAddress: { firstName: "Peter", lastName: "Braun", street: "Ringstraße", streetNumber: "99", city: "Köln", postalCode: "50667", country: "DE" }, shippingAddress: { firstName: "Peter", lastName: "Braun", street: "Ringstraße", streetNumber: "99", city: "Köln", postalCode: "50667", country: "DE" }, acceptedTerms: true, acceptedCancellationPolicy: true },
  ];

  for (let i = 0; i < demoOrders.length; i++) {
    try {
      const [order] = await db.insert(orders).values(demoOrders[i]).returning();
      console.log("Created order:", order.orderNumber);
      const product = products[i % products.length];
      const productName = product.translations[0]?.name || product.sku;
      await db.insert(orderItems).values({ orderId: order.id, productId: product.id, sku: product.sku, name: productName, quantity: 1, unitPriceNet: product.priceNet, unitPriceGross: product.priceGross, totalNet: product.priceNet, totalGross: product.priceGross, taxRate: 19 });
    } catch (e) {
      console.log("Order might exist, skipping:", demoOrders[i].orderNumber);
    }
  }

  try {
    await db.insert(coupons).values({ code: "WELCOME10", type: "percentage", value: 10, minOrderValue: 2000, usageLimit: 100, usageCount: 0, isActive: true, startsAt: new Date(), expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) });
    console.log("Created coupon: WELCOME10");
  } catch (e) {
    console.log("Coupon might exist, skipping");
  }
  
  console.log("Done!");
}

seedDemoData().catch(console.error).finally(() => process.exit(0));

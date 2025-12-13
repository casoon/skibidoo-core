import { router } from "./trpc";
import { productRouter } from "./routers/product";
import { customerRouter } from "./routers/customer";
import { orderRouter } from "./routers/order";
import { categoryRouter } from "./routers/category";
import { shippingRouter } from "./routers/shipping";
import { paymentRouter } from "./routers/payment";
import { couponRouter } from "./routers/coupon";
import { taxRouter } from "./routers/tax";
import { deliveryTimeRouter } from "./routers/deliveryTime";
import { adminUserRouter } from "./routers/adminUser";

export const appRouter = router({
  product: productRouter,
  customer: customerRouter,
  order: orderRouter,
  category: categoryRouter,
  shipping: shippingRouter,
  payment: paymentRouter,
  coupon: couponRouter,
  tax: taxRouter,
  deliveryTime: deliveryTimeRouter,
  adminUser: adminUserRouter,
});

export type AppRouter = typeof appRouter;

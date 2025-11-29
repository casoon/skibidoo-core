import { router } from "./trpc";
import { productRouter } from "./routers/product";
import { customerRouter } from "./routers/customer";
import { orderRouter } from "./routers/order";
import { categoryRouter } from "./routers/category";
import { shippingRouter } from "./routers/shipping";
import { paymentRouter } from "./routers/payment";
import { couponRouter } from "./routers/coupon";
import { taxRouter } from "./routers/tax";

export const appRouter = router({
  product: productRouter,
  customer: customerRouter,
  order: orderRouter,
  category: categoryRouter,
  shipping: shippingRouter,
  payment: paymentRouter,
  coupon: couponRouter,
  tax: taxRouter,
});

export type AppRouter = typeof appRouter;

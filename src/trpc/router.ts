import { router } from "./trpc";
import { productRouter } from "./routers/product";
import { customerRouter } from "./routers/customer";
import { orderRouter } from "./routers/order";

export const appRouter = router({
  product: productRouter,
  customer: customerRouter,
  order: orderRouter,
});

export type AppRouter = typeof appRouter;

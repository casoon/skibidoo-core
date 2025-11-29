// Currency REST Routes
import { Hono } from "hono";
import { currencyService } from "./currency-service.js";

export const currencyRoutes = new Hono();

currencyRoutes.get("/", async (c) => {
  const activeOnly = c.req.query("active") === "true";
  const currencies = await currencyService.getAllCurrencies(activeOnly);
  return c.json({ currencies });
});

currencyRoutes.get("/default", async (c) => {
  const currency = await currencyService.getDefaultCurrency();
  return c.json(currency);
});

currencyRoutes.get("/:code", async (c) => {
  const code = c.req.param("code");
  const currency = await currencyService.getCurrency(code);
  if (!currency) return c.json({ error: "Currency not found" }, 404);
  return c.json(currency);
});

currencyRoutes.put("/:code", async (c) => {
  const code = c.req.param("code");
  const body = await c.req.json();
  try {
    const currency = await currencyService.updateCurrency(code, body);
    return c.json(currency);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

currencyRoutes.post("/:code/set-default", async (c) => {
  const code = c.req.param("code");
  try {
    await currencyService.setDefaultCurrency(code);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

currencyRoutes.post("/exchange-rate", async (c) => {
  const body = await c.req.json();
  try {
    await currencyService.setExchangeRate(body.from, body.to, body.rate);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

currencyRoutes.get("/exchange-rate/:from/:to", async (c) => {
  const from = c.req.param("from");
  const to = c.req.param("to");
  try {
    const rate = await currencyService.getExchangeRate(from, to);
    return c.json({ from, to, rate });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

currencyRoutes.post("/convert", async (c) => {
  const body = await c.req.json();
  try {
    const result = await currencyService.convert(body.amount, body.from, body.to);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

currencyRoutes.post("/format", async (c) => {
  const body = await c.req.json();
  const formatted = await currencyService.format(body.amount, body.currency);
  return c.json({ formatted });
});

currencyRoutes.get("/prices/:amount", async (c) => {
  const amount = parseFloat(c.req.param("amount"));
  const from = c.req.query("from") || "EUR";
  const prices = await currencyService.getPricesInAllCurrencies(amount, from);
  return c.json({ prices });
});

currencyRoutes.get("/config", async (c) => {
  return c.json(currencyService.getConfig());
});

currencyRoutes.put("/config", async (c) => {
  const body = await c.req.json();
  const config = await currencyService.updateConfig(body);
  return c.json(config);
});

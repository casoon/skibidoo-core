import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyAccessToken, type TokenPayload } from "./jwt";

// Extend Hono context with user
declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload | null;
  }
}

// Optional auth - sets user if token valid, continues if not
export const optionalAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("authorization");
  
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);
    c.set("user", payload);
  } else {
    c.set("user", null);
  }
  
  await next();
});

// Required auth - returns 401 if no valid token
export const requireAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Authorization required" });
  }
  
  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);
  
  if (!payload) {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
  
  c.set("user", payload);
  await next();
});

// Admin auth - returns 403 if not admin
export const requireAdmin = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Authorization required" });
  }
  
  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);
  
  if (!payload) {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
  
  if (payload.role !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
  
  c.set("user", payload);
  await next();
});

import type { Database } from "../db";
import type { Logger } from "pino";

export interface User {
  id: string;
  email: string;
  role: "admin" | "customer";
}

export interface Context {
  db: Database;
  logger: Logger;
  user: User | null;
  requestId: string;
}

export type CreateContextOptions = {
  db: Database;
  logger: Logger;
  authHeader?: string;
  requestId: string;
};

export async function createContext(opts: CreateContextOptions): Promise<Context> {
  const { db, logger, authHeader, requestId } = opts;
  
  let user: User | null = null;
  
  // TODO: Implement JWT verification
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // user = await verifyToken(token);
  }
  
  return {
    db,
    logger: logger.child({ requestId }),
    user,
    requestId,
  };
}

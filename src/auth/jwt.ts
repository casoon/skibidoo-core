import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/config/env.js";

export interface TokenPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  role: "admin" | "customer";
  type: "access" | "refresh";
}

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function signAccessToken(payload: Omit<TokenPayload, "type" | "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRY + "s")
    .sign(secret);
}

export async function signRefreshToken(payload: Omit<TokenPayload, "type" | "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }
  return payload;
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "refresh") {
    return null;
  }
  return payload;
}

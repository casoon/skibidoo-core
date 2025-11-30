// Gift Card Utilities
// src/giftcards/utils.ts

import { randomBytes } from "crypto";

/**
 * Generate a unique gift card code
 * Format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric characters)
 */
export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing characters (0, O, 1, I)
  const segments = 4;
  const segmentLength = 4;
  
  const parts: string[] = [];
  
  for (let i = 0; i < segments; i++) {
    let segment = "";
    const bytes = randomBytes(segmentLength);
    for (let j = 0; j < segmentLength; j++) {
      segment += chars[bytes[j] % chars.length];
    }
    parts.push(segment);
  }
  
  return parts.join("-");
}

/**
 * Validate gift card code format
 */
export function isValidCodeFormat(code: string): boolean {
  // Accept with or without dashes
  const normalized = code.replace(/-/g, "").toUpperCase();
  return /^[A-Z0-9]{16}$/.test(normalized);
}

/**
 * Normalize gift card code (uppercase, with dashes)
 */
export function normalizeCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length !== 16) return code.toUpperCase();
  
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
}

/**
 * Format currency amount for display
 */
export function formatGiftCardAmount(cents: number, currencyCode: string = "EUR"): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

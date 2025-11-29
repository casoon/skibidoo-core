// Currency Types
// src/currency/types.ts

export interface Currency {
  code: string;           // ISO 4217 code (EUR, USD, CHF)
  name: string;           // Display name
  symbol: string;         // Currency symbol
  symbolPosition: "before" | "after";
  decimalSeparator: string;
  thousandsSeparator: string;
  decimals: number;
  isDefault: boolean;
  isActive: boolean;
  exchangeRate: number;   // Rate relative to base currency
  updatedAt: Date;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  source: string;
  updatedAt: Date;
}

export interface MoneyAmount {
  amount: number;         // Amount in smallest unit (cents)
  currency: string;       // Currency code
  formatted?: string;     // Formatted display string
}

export interface PriceConversion {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  formattedOriginal: string;
  formattedConverted: string;
}

export interface CurrencyConfig {
  baseCurrency: string;
  availableCurrencies: string[];
  autoUpdateRates: boolean;
  rateUpdateInterval: number; // hours
  roundingMode: "up" | "down" | "nearest";
  displayPricesInBoth: boolean;
}

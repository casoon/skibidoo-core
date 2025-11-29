// Currency Service
import type { Currency, ExchangeRate, MoneyAmount, PriceConversion, CurrencyConfig } from "./types.js";

const defaultCurrencies: Currency[] = [
  { code: "EUR", name: "Euro", symbol: "\u20ac", symbolPosition: "after", decimalSeparator: ",", thousandsSeparator: ".", decimals: 2, isDefault: true, isActive: true, exchangeRate: 1, updatedAt: new Date() },
  { code: "CHF", name: "Schweizer Franken", symbol: "CHF", symbolPosition: "before", decimalSeparator: ".", thousandsSeparator: "'", decimals: 2, isDefault: false, isActive: true, exchangeRate: 0.95, updatedAt: new Date() },
  { code: "USD", name: "US-Dollar", symbol: "$", symbolPosition: "before", decimalSeparator: ".", thousandsSeparator: ",", decimals: 2, isDefault: false, isActive: false, exchangeRate: 1.08, updatedAt: new Date() },
  { code: "GBP", name: "Britisches Pfund", symbol: "\u00a3", symbolPosition: "before", decimalSeparator: ".", thousandsSeparator: ",", decimals: 2, isDefault: false, isActive: false, exchangeRate: 0.86, updatedAt: new Date() },
];

const currencies = new Map<string, Currency>();
for (const c of defaultCurrencies) currencies.set(c.code, c);

let config: CurrencyConfig = { baseCurrency: "EUR", availableCurrencies: ["EUR", "CHF"], autoUpdateRates: false, rateUpdateInterval: 24, roundingMode: "nearest", displayPricesInBoth: false };

export const currencyService = {
  async getAllCurrencies(activeOnly = false): Promise<Currency[]> {
    const all = Array.from(currencies.values());
    return activeOnly ? all.filter(c => c.isActive) : all;
  },
  async getCurrency(code: string): Promise<Currency | null> { return currencies.get(code.toUpperCase()) || null; },
  async getDefaultCurrency(): Promise<Currency> { return Array.from(currencies.values()).find(c => c.isDefault) || currencies.get("EUR")!; },
  async setDefaultCurrency(code: string): Promise<void> {
    const currency = currencies.get(code.toUpperCase());
    if (!currency) throw new Error("Currency not found");
    for (const c of currencies.values()) c.isDefault = false;
    currency.isDefault = true;
    config.baseCurrency = code;
  },
  async updateCurrency(code: string, updates: Partial<Currency>): Promise<Currency> {
    const currency = currencies.get(code.toUpperCase());
    if (!currency) throw new Error("Currency not found");
    Object.assign(currency, updates, { updatedAt: new Date() });
    return currency;
  },
  async setExchangeRate(from: string, to: string, rate: number): Promise<void> {
    const toCurrency = currencies.get(to.toUpperCase());
    if (toCurrency && from.toUpperCase() === config.baseCurrency) {
      toCurrency.exchangeRate = rate;
      toCurrency.updatedAt = new Date();
    }
  },
  async getExchangeRate(from: string, to: string): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) return 1;
    const fromC = currencies.get(from.toUpperCase());
    const toC = currencies.get(to.toUpperCase());
    if (!fromC || !toC) throw new Error("Invalid currency");
    if (from.toUpperCase() === config.baseCurrency) return toC.exchangeRate;
    if (to.toUpperCase() === config.baseCurrency) return 1 / fromC.exchangeRate;
    return (1 / fromC.exchangeRate) * toC.exchangeRate;
  },
  async convert(amount: number, from: string, to: string): Promise<PriceConversion> {
    const rate = await this.getExchangeRate(from, to);
    const converted = this.roundAmount(amount * rate, to);
    return { originalAmount: amount, originalCurrency: from.toUpperCase(), convertedAmount: converted, targetCurrency: to.toUpperCase(), exchangeRate: rate, formattedOriginal: await this.format(amount, from), formattedConverted: await this.format(converted, to) };
  },
  async format(amount: number, code: string): Promise<string> {
    const c = currencies.get(code.toUpperCase());
    if (!c) return amount.toFixed(2) + " " + code;
    const parts = amount.toFixed(c.decimals).split(".");
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, c.thousandsSeparator);
    const dec = parts[1];
    const num = dec ? int + c.decimalSeparator + dec : int;
    return c.symbolPosition === "before" ? c.symbol + " " + num : num + " " + c.symbol;
  },
  roundAmount(amount: number, code: string): number {
    const c = currencies.get(code.toUpperCase());
    const dec = c?.decimals ?? 2;
    const f = Math.pow(10, dec);
    if (config.roundingMode === "up") return Math.ceil(amount * f) / f;
    if (config.roundingMode === "down") return Math.floor(amount * f) / f;
    return Math.round(amount * f) / f;
  },
  async createMoney(amount: number, code: string): Promise<MoneyAmount> {
    return { amount: this.roundAmount(amount, code), currency: code.toUpperCase(), formatted: await this.format(amount, code) };
  },
  getConfig(): CurrencyConfig { return { ...config }; },
  async updateConfig(updates: Partial<CurrencyConfig>): Promise<CurrencyConfig> { config = { ...config, ...updates }; return config; },
  async getPricesInAllCurrencies(amount: number, from: string): Promise<MoneyAmount[]> {
    const active = await this.getAllCurrencies(true);
    const prices: MoneyAmount[] = [];
    for (const c of active) {
      const conv = await this.convert(amount, from, c.code);
      prices.push({ amount: conv.convertedAmount, currency: c.code, formatted: conv.formattedConverted });
    }
    return prices;
  },
};

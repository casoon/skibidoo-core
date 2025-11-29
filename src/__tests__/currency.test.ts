// Currency Service Tests
import { describe, it, expect, beforeEach } from "vitest";
import { currencyService } from "../currency/currency-service.js";

describe("currencyService", () => {
  describe("getAllCurrencies", () => {
    it("should return all currencies", async () => {
      const currencies = await currencyService.getAllCurrencies();
      expect(currencies.length).toBeGreaterThanOrEqual(4);
      expect(currencies.some(c => c.code === "EUR")).toBe(true);
      expect(currencies.some(c => c.code === "CHF")).toBe(true);
      expect(currencies.some(c => c.code === "USD")).toBe(true);
      expect(currencies.some(c => c.code === "GBP")).toBe(true);
    });

    it("should filter active currencies only", async () => {
      const active = await currencyService.getAllCurrencies(true);
      expect(active.every(c => c.isActive)).toBe(true);
    });
  });

  describe("getCurrency", () => {
    it("should get currency by code", async () => {
      const eur = await currencyService.getCurrency("EUR");
      expect(eur).toBeDefined();
      expect(eur?.code).toBe("EUR");
      expect(eur?.symbol).toBe("\u20ac");
    });

    it("should be case-insensitive", async () => {
      const eur = await currencyService.getCurrency("eur");
      expect(eur?.code).toBe("EUR");
    });

    it("should return null for unknown currency", async () => {
      const unknown = await currencyService.getCurrency("XXX");
      expect(unknown).toBeNull();
    });
  });

  describe("getDefaultCurrency", () => {
    it("should return the default currency", async () => {
      const defaultCurrency = await currencyService.getDefaultCurrency();
      expect(defaultCurrency).toBeDefined();
      expect(defaultCurrency.isDefault).toBe(true);
    });
  });

  describe("setDefaultCurrency", () => {
    it("should set a new default currency", async () => {
      await currencyService.setDefaultCurrency("CHF");
      const defaultCurrency = await currencyService.getDefaultCurrency();
      expect(defaultCurrency.code).toBe("CHF");

      // Reset to EUR
      await currencyService.setDefaultCurrency("EUR");
    });

    it("should throw error for unknown currency", async () => {
      await expect(
        currencyService.setDefaultCurrency("XXX")
      ).rejects.toThrow("Currency not found");
    });
  });

  describe("getExchangeRate", () => {
    it("should return 1 for same currency", async () => {
      const rate = await currencyService.getExchangeRate("EUR", "EUR");
      expect(rate).toBe(1);
    });

    it("should return exchange rate for base to target", async () => {
      const rate = await currencyService.getExchangeRate("EUR", "CHF");
      expect(rate).toBeGreaterThan(0);
    });

    it("should calculate inverse rate correctly", async () => {
      const eurToChf = await currencyService.getExchangeRate("EUR", "CHF");
      const chfToEur = await currencyService.getExchangeRate("CHF", "EUR");
      expect(eurToChf * chfToEur).toBeCloseTo(1, 5);
    });

    it("should throw for invalid currency", async () => {
      await expect(
        currencyService.getExchangeRate("EUR", "XXX")
      ).rejects.toThrow("Invalid currency");
    });
  });

  describe("convert", () => {
    it("should convert EUR to CHF correctly", async () => {
      const result = await currencyService.convert(100, "EUR", "CHF");
      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe("EUR");
      expect(result.targetCurrency).toBe("CHF");
      expect(result.convertedAmount).toBeGreaterThan(0);
      expect(result.exchangeRate).toBeGreaterThan(0);
      expect(result.formattedOriginal).toContain("100");
      expect(result.formattedConverted).toContain("CHF");
    });

    it("should handle same currency conversion", async () => {
      const result = await currencyService.convert(50, "EUR", "EUR");
      expect(result.convertedAmount).toBe(50);
      expect(result.exchangeRate).toBe(1);
    });

    it("should convert CHF to EUR", async () => {
      const result = await currencyService.convert(100, "CHF", "EUR");
      expect(result.convertedAmount).toBeGreaterThan(0);
    });
  });

  describe("format", () => {
    it("should format EUR with symbol after", async () => {
      const formatted = await currencyService.format(99.99, "EUR");
      expect(formatted).toContain("99");
      expect(formatted).toContain("\u20ac");
    });

    it("should format CHF with symbol before", async () => {
      const formatted = await currencyService.format(50.00, "CHF");
      expect(formatted).toContain("50");
      expect(formatted).toContain("CHF");
    });

    it("should use correct decimal separator for EUR", async () => {
      const formatted = await currencyService.format(10.50, "EUR");
      expect(formatted).toContain(",");
    });

    it("should use correct thousands separator", async () => {
      const formatted = await currencyService.format(1234567.89, "EUR");
      expect(formatted).toContain(".");
    });
  });

  describe("roundAmount", () => {
    it("should round to 2 decimal places by default", () => {
      const rounded = currencyService.roundAmount(10.555, "EUR");
      expect(rounded).toBe(10.56);
    });

    it("should handle different rounding modes", async () => {
      const config = currencyService.getConfig();
      
      // Test with default (nearest)
      expect(currencyService.roundAmount(10.555, "EUR")).toBe(10.56);
      expect(currencyService.roundAmount(10.554, "EUR")).toBe(10.55);
    });
  });

  describe("createMoney", () => {
    it("should create a MoneyAmount object", async () => {
      const money = await currencyService.createMoney(49.99, "EUR");
      expect(money.amount).toBe(49.99);
      expect(money.currency).toBe("EUR");
      expect(money.formatted).toBeDefined();
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", () => {
      const config = currencyService.getConfig();
      expect(config.baseCurrency).toBeDefined();
      expect(config.availableCurrencies).toBeInstanceOf(Array);
      expect(typeof config.autoUpdateRates).toBe("boolean");
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", async () => {
      const original = currencyService.getConfig();
      
      await currencyService.updateConfig({
        displayPricesInBoth: true,
      });

      const updated = currencyService.getConfig();
      expect(updated.displayPricesInBoth).toBe(true);

      // Reset
      await currencyService.updateConfig({
        displayPricesInBoth: original.displayPricesInBoth,
      });
    });
  });

  describe("getPricesInAllCurrencies", () => {
    it("should return prices in all active currencies", async () => {
      const prices = await currencyService.getPricesInAllCurrencies(100, "EUR");
      expect(prices.length).toBeGreaterThanOrEqual(1);
      expect(prices.every(p => p.amount > 0)).toBe(true);
      expect(prices.every(p => p.currency.length > 0)).toBe(true);
      expect(prices.every(p => p.formatted !== undefined)).toBe(true);
    });
  });

  describe("setExchangeRate", () => {
    it("should update exchange rate for a currency", async () => {
      const originalRate = (await currencyService.getCurrency("CHF"))?.exchangeRate;
      
      await currencyService.setExchangeRate("EUR", "CHF", 0.92);
      
      const chf = await currencyService.getCurrency("CHF");
      expect(chf?.exchangeRate).toBe(0.92);

      // Reset
      if (originalRate) {
        await currencyService.setExchangeRate("EUR", "CHF", originalRate);
      }
    });
  });

  describe("updateCurrency", () => {
    it("should update currency properties", async () => {
      const original = await currencyService.getCurrency("USD");
      
      await currencyService.updateCurrency("USD", {
        isActive: true,
      });

      const updated = await currencyService.getCurrency("USD");
      expect(updated?.isActive).toBe(true);

      // Reset
      await currencyService.updateCurrency("USD", {
        isActive: original?.isActive ?? false,
      });
    });
  });
});

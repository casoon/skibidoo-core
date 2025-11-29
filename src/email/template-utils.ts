import mjml2html from "mjml";

export interface TemplateData {
  [key: string]: unknown;
}

export function compileMjml(mjmlContent: string): string {
  const result = mjml2html(mjmlContent, {
    validationLevel: "soft",
    minify: true,
  });

  if (result.errors && result.errors.length > 0) {
    console.warn("MJML compilation warnings:", result.errors);
  }

  return result.html;
}

export function interpolate(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let value: unknown = data;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match;
      }
    }

    return String(value ?? "");
  });
}

export function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

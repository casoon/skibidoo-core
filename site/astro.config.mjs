// @ts-check
import casoonPages from '@casoon/pages-theme';
import { defineConfig } from 'astro/config';

// Project page: https://casoon.github.io/skibidoo-core/ — `base` is the GitHub Pages path.
export default defineConfig({
  site: 'https://casoon.github.io/skibidoo-core',
  base: '/skibidoo-core/',
  integrations: [
    casoonPages({
      name: 'Skibidoo',
      description:
        'Selbst gehostetes, headless betriebenes Shopsystem: Backend mit REST- und tRPC-API, Storefront, Admin und UI-Komponenten.',
      tagline: 'Headless-Shopsystem mit Hono und Astro',
      repo: 'casoon/skibidoo-core',
      license: 'MIT',
      lang: 'de',
      docsGroups: {
        'getting-started': 'Erste Schritte',
        concepts: 'Konzepte',
        reference: 'Referenz',
      },
      showcase: false,
    }),
  ],
});

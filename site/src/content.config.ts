import { docsCollection } from '@casoon/pages-theme/content';

// Sources: ../site-docs (site-docs/ in the repository). Not docs/: Docs/ holds other notes
// and the two names are the same directory on case-insensitive file systems.
export const collections = { docs: docsCollection({ base: '../site-docs' }) };

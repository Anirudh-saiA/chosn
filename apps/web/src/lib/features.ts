/**
 * Sections that are built but not open yet: their routes show a "Coming soon" page and the header marks them.
 * Flip a value to false to open the section again (no other change needed).
 */
export const COMING_SOON = {
  drops: true,
  news: true,
  community: true,
} as const;

export type ComingSoonSection = keyof typeof COMING_SOON;

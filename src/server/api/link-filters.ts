import { and, eq, gte, type SQL } from "drizzle-orm";

import { links } from "~/server/db/schema";

export type LinkQueryOptions = { createdAfter?: Date };

/**
 * Redis writes needed to make migrated guest links redirect again.
 *
 * `PERSIST` only clears a TTL; it cannot revive a key that already expired.
 * Guest links expire from Redis after a day, so migration must re-write the
 * URL with no expiry. Keys are lowercase to match the middleware lookup.
 */
export function buildMigratedLinkCacheWrites(
  links: ReadonlyArray<{ slug: string; url: string }>,
): Array<{ key: string; value: string }> {
  return links.map((link) => ({
    key: link.slug.toLowerCase(),
    value: link.url,
  }));
}

/**
 * Builds the WHERE clause for a user's links.
 *
 * `createdAfter` is opt-in because the two callers need different windows:
 * the guest list must hide links past the guest TTL, while the sign-in
 * migration must move every guest link regardless of age.
 */
export function buildUserLinkWhere(
  userLinkId: string,
  options: LinkQueryOptions = {},
): SQL {
  const base = eq(links.userLinkId, userLinkId);

  if (!options.createdAfter) return base;

  // `and()` is typed `SQL | undefined`, but with two or more conditions it
  // always returns an SQL object at runtime.
  return and(base, gte(links.createdAt, options.createdAfter)) as SQL;
}

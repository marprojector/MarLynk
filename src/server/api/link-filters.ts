import { and, eq, gte, type SQL } from "drizzle-orm";

import { links } from "~/server/db/schema";

export type LinkQueryOptions = { createdAfter?: Date };

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

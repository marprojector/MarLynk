export const GUEST_LINK_EXPIRE_TIME = 60 * 60 * 24; // 1 day
export const GUEST_LINK_COOKIE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * How long a guest link row survives in the database.
 *
 * This must match the guest cookie lifetime, not the guest display window:
 * the row is the only source of the original URL once the Redis key has
 * expired, so deleting it after a day would make a later sign-in migration
 * unable to restore the link. Guests still only *see* links from the last
 * GUEST_LINK_EXPIRE_TIME seconds.
 */
export const GUEST_LINK_RETENTION_TIME = GUEST_LINK_COOKIE_EXPIRATION_TIME / 1000; // 30 days

import assert from "node:assert/strict";
import test from "node:test";

import {
  GUEST_LINK_COOKIE_EXPIRATION_TIME,
  GUEST_LINK_RETENTION_TIME,
} from "~/lib/config";

test("guest rows are retained for the full guest cookie lifetime", () => {
  const cookieDays = GUEST_LINK_COOKIE_EXPIRATION_TIME / (1000 * 60 * 60 * 24);
  const retentionDays = GUEST_LINK_RETENTION_TIME / (60 * 60 * 24);

  assert.equal(retentionDays, cookieDays);
});

test("retention outlives the guest display window", () => {
  assert.ok(GUEST_LINK_RETENTION_TIME > 60 * 60 * 24);
});

import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

import { buildUserLinkWhere } from "~/server/api/link-filters";

const dialect = new SQLiteSyncDialect();
const render = (w: ReturnType<typeof buildUserLinkWhere>) =>
  dialect.sqlToQuery(w);

test("omitting createdAfter filters only by userLinkId", () => {
  const q = render(buildUserLinkWhere("ul_1"));
  assert.match(q.sql, /"userLinkId"/);
  assert.doesNotMatch(q.sql, /created_at/);
  assert.deepEqual(q.params, ["ul_1"]);
});

test("passing createdAfter bounds the query to that instant", () => {
  const q = render(
    buildUserLinkWhere("ul_1", { createdAfter: new Date(1700000000000) }),
  );
  assert.match(q.sql, /created_at/);
  assert.deepEqual(q.params, ["ul_1", 1700000000]);
});

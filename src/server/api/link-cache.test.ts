import assert from "node:assert/strict";
import test from "node:test";

import { buildMigratedLinkCacheWrites } from "~/server/api/link-filters";

const links = [
  { slug: "Old-One", url: "https%3A%2F%2Fexample.com%2F" },
  { slug: "second", url: "https%3A%2F%2Fexample.org%2F" },
];

test("migration re-writes every link URL with no expiry", () => {
  const writes = buildMigratedLinkCacheWrites(links);

  assert.deepEqual(writes, [
    { key: "old-one", value: "https%3A%2F%2Fexample.com%2F" },
    { key: "second", value: "https%3A%2F%2Fexample.org%2F" },
  ]);
});

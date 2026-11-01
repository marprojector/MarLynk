import assert from "node:assert/strict";
import test from "node:test";

import { resolveTursoConfig } from "~/server/db/config";

test("uses configured url and token when both are present", () => {
  assert.deepEqual(
    resolveTursoConfig({ url: "libsql://db.example", token: "secret" }),
    { url: "libsql://db.example", authToken: "secret" },
  );
});

test("falls back to a placeholder url when credentials are missing", () => {
  const config = resolveTursoConfig({ url: undefined, token: undefined });

  assert.equal(typeof config.url, "string");
  assert.ok(config.url.length > 0);
  assert.ok(!config.url.includes("undefined"));
});

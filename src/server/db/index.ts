import { createClient } from "@libsql/client/web";
import { env } from "~/env";
import { drizzle } from "drizzle-orm/libsql";

import { resolveTursoConfig } from "./config";
import * as schema from "./schema";

const client = createClient(
  resolveTursoConfig({
    url: env.TURSO_URL,
    token: env.TURSO_AUTH_TOKEN,
  }),
);

export const db = drizzle(client, { schema, logger: true });

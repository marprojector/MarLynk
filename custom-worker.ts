// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import type {
  ExecutionContext,
  ScheduledController,
} from "@cloudflare/workers-types";

export default {
  fetch: handler.fetch,

  /**
   * Cloudflare Cron Trigger entry point. Calls the existing /api/cron route
   * in-process rather than over the network, so no public URL is needed and
   * the request cannot loop back through the Worker.
   */
  async scheduled(
    _controller: ScheduledController,
    env: { CRON_SECRET: string },
    ctx: ExecutionContext,
  ) {
    const response = await handler.fetch(
      new Request("https://marlynk.ammararief.my.id/api/cron", {
        method: "GET",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }),
      env,
      ctx,
    );

    if (!response.ok) {
      console.error(`cron failed: ${response.status} ${await response.text()}`);
    }
  },
};

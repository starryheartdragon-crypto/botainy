/**
 * Cloudflare Worker scheduled handler.
 * Wrangler routes the cron trigger ("0 3 * * *") here.
 *
 * Uses the WORKER_SELF_REFERENCE service binding to call the
 * Next.js API route /api/leaderboard/recalculate internally,
 * authenticated by the CRON_SECRET environment variable.
 *
 * Place this file at the project root. Reference it in wrangler.jsonc
 * or merge the `scheduled` export with the opennext worker entry.
 *
 * NOTE: With @opennextjs/cloudflare you can export a `scheduled` handler
 * from a custom worker file and set "main" in wrangler.jsonc to point to it,
 * wrapping the opennext handler. This file documents the intended logic;
 * see SETUP.md for wiring instructions.
 */
export default {
  // The `scheduled` export is invoked by Cloudflare Cron Triggers
  async scheduled(
    _event: ScheduledEvent,
    env: {
      WORKER_SELF_REFERENCE: { fetch: (req: Request) => Promise<Response> }
      CRON_SECRET: string
    },
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(
        new Request('https://botainy.workers.dev/api/leaderboard/recalculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.CRON_SECRET}`,
          },
        })
      )
    )
  },
}

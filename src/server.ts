import { serve } from "@hono/node-server";
import app from "./agent-app.js";

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`yield-pool-watcher listening on http://127.0.0.1:${info.port}`);
});

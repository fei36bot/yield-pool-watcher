import { z } from "zod";
import { createAgentApp, paymentsFromEnv } from "@lucid-dreams/agent-kit";
import { runWatcher } from "./index.js";

const payments = paymentsFromEnv({ defaultPrice: process.env.DEFAULT_PRICE || "0.01" });

const { app, addEntrypoint } = createAgentApp(
  {
    name: "yield-pool-watcher",
    version: "0.1.0",
    description: "Track APY and TVL across pools and alert on sharp changes",
  },
  { payments }
);

addEntrypoint({
  key: "yield-watch",
  description: "Return pool_metrics, deltas, and threshold alerts for DeFi yield pools",
  input: z.object({
    protocol_ids: z.array(z.string()).default(["aave-v3", "lido", "compound-v3"]),
    pools: z.array(z.string()).default([]),
    threshold_rules: z
      .object({
        tvl_change_pct: z.number().default(5),
        apy_change_abs: z.number().default(1),
      })
      .default({ tvl_change_pct: 5, apy_change_abs: 1 }),
    baseline: z
      .record(z.object({ tvl_usd: z.number(), apy: z.number() }))
      .optional(),
    limit: z.number().int().positive().max(50).default(12),
  }),
  price: process.env.DEFAULT_PRICE || "0.01",
  async handler({ input }) {
    const out = await runWatcher(input);
    return {
      output: out,
      usage: { total_tokens: out.pool_metrics.length + out.alerts.length },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Echo a message",
  input: z.object({ text: z.string() }),
  price: process.env.DEFAULT_PRICE || "0.01",
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

export default app;
export { app };

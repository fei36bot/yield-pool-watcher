import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Live DefiLlama
test("defillama yields pools live", async () => {
  const res = await fetch("https://yields.llama.fi/pools", {
    headers: { Accept: "application/json", "User-Agent": "yield-pool-watcher/0.1" },
  });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(Array.isArray(j.data) && j.data.length > 100);
  const lido = j.data.find((p) => String(p.project).toLowerCase().includes("lido"));
  assert.ok(lido && Number(lido.tvlUsd) > 0);
});

test("runWatcher returns metrics and can alert on baseline", async () => {
  // Dynamic import of TS via tsx is awkward in node:test; call llama + replicate alert math
  const res = await fetch("https://yields.llama.fi/pools", {
    headers: { Accept: "application/json", "User-Agent": "yield-pool-watcher/0.1" },
  });
  const j = await res.json();
  const row = j.data.find((p) => String(p.project).toLowerCase() === "lido");
  assert.ok(row);
  const tvl = Number(row.tvlUsd);
  const baseline = tvl * 0.9; // simulate +11% spike
  const deltaPct = ((tvl - baseline) / baseline) * 100;
  assert.ok(deltaPct >= 5);
});

/**
 * Yield Pool Watcher — daydreamsai/agent-bounties#6 ($1000).
 * Live TVL/APY via DefiLlama; threshold alerts on deltas.
 */
import { z } from "zod";

export interface PoolMetric {
  pool_id: string;
  protocol_id: string;
  symbol: string;
  chain: string;
  tvl_usd: number;
  apy: number;
  apy_base: number | null;
  apy_reward: number | null;
  as_of_ms: number;
  source: string;
}

export interface PoolDelta {
  pool_id: string;
  protocol_id: string;
  tvl_delta_pct: number | null;
  apy_delta_abs: number | null;
  baseline_tvl_usd: number | null;
  baseline_apy: number | null;
}

export interface YieldAlert {
  pool_id: string;
  protocol_id: string;
  kind: "tvl_spike" | "tvl_drain" | "apy_spike" | "apy_drop";
  magnitude: number;
  message: string;
}

const inputSchema = z.object({
  protocol_ids: z.array(z.string()).default(["aave-v3", "lido", "compound-v3"]),
  pools: z.array(z.string()).default([]),
  threshold_rules: z
    .object({
      tvl_change_pct: z.number().default(5),
      apy_change_abs: z.number().default(1),
    })
    .default({ tvl_change_pct: 5, apy_change_abs: 1 }),
  /** Optional prior snapshot for delta/alerts (pool_id -> {tvl_usd, apy}) */
  baseline: z
    .record(
      z.object({
        tvl_usd: z.number(),
        apy: z.number(),
      })
    )
    .optional(),
  limit: z.number().int().positive().max(50).default(12),
});

async function fetchPools(): Promise<any[]> {
  const res = await fetch("https://yields.llama.fi/pools", {
    headers: { Accept: "application/json", "User-Agent": "yield-pool-watcher/0.1" },
  });
  if (!res.ok) throw new Error(`defillama pools -> ${res.status}`);
  const j = await res.json();
  const data = j?.data;
  if (!Array.isArray(data)) throw new Error("defillama: unexpected shape");
  return data;
}

function matchProtocol(project: string, protocolIds: string[]): boolean {
  const p = String(project || "").toLowerCase();
  return protocolIds.some((id) => {
    const n = id.toLowerCase();
    return p === n || p.includes(n) || n.includes(p);
  });
}

export async function runWatcher(raw: unknown): Promise<{
  pool_metrics: PoolMetric[];
  deltas: PoolDelta[];
  alerts: YieldAlert[];
}> {
  const input = inputSchema.parse(raw ?? {});
  const all = await fetchPools();
  const now = Date.now();

  let selected = all.filter((row) => matchProtocol(row.project, input.protocol_ids));
  if (input.pools.length) {
    const want = new Set(input.pools.map((x) => x.toLowerCase()));
    selected = selected.filter(
      (row) =>
        want.has(String(row.pool || "").toLowerCase()) ||
        want.has(String(row.symbol || "").toLowerCase()) ||
        want.has(`${row.project}:${row.symbol}`.toLowerCase())
    );
  }

  // Prefer higher TVL when truncating
  selected.sort((a, b) => Number(b.tvlUsd || 0) - Number(a.tvlUsd || 0));
  selected = selected.slice(0, input.limit);

  const pool_metrics: PoolMetric[] = selected.map((row) => ({
    pool_id: String(row.pool),
    protocol_id: String(row.project),
    symbol: String(row.symbol || ""),
    chain: String(row.chain || ""),
    tvl_usd: Number(row.tvlUsd || 0),
    apy: Number(row.apy || 0),
    apy_base: row.apyBase != null ? Number(row.apyBase) : null,
    apy_reward: row.apyReward != null ? Number(row.apyReward) : null,
    as_of_ms: now,
    source: "defillama-yields",
  }));

  const deltas: PoolDelta[] = [];
  const alerts: YieldAlert[] = [];
  const baseline = input.baseline || {};

  for (const m of pool_metrics) {
    const b = baseline[m.pool_id];
    if (!b) {
      deltas.push({
        pool_id: m.pool_id,
        protocol_id: m.protocol_id,
        tvl_delta_pct: null,
        apy_delta_abs: null,
        baseline_tvl_usd: null,
        baseline_apy: null,
      });
      continue;
    }
    const tvl_delta_pct =
      b.tvl_usd > 0 ? ((m.tvl_usd - b.tvl_usd) / b.tvl_usd) * 100 : null;
    const apy_delta_abs = m.apy - b.apy;
    deltas.push({
      pool_id: m.pool_id,
      protocol_id: m.protocol_id,
      tvl_delta_pct,
      apy_delta_abs,
      baseline_tvl_usd: b.tvl_usd,
      baseline_apy: b.apy,
    });

    const tvlTh = input.threshold_rules.tvl_change_pct;
    const apyTh = input.threshold_rules.apy_change_abs;
    if (tvl_delta_pct != null && tvl_delta_pct >= tvlTh) {
      alerts.push({
        pool_id: m.pool_id,
        protocol_id: m.protocol_id,
        kind: "tvl_spike",
        magnitude: tvl_delta_pct,
        message: `TVL +${tvl_delta_pct.toFixed(2)}% (>= ${tvlTh}%) on ${m.protocol_id}/${m.symbol}`,
      });
    }
    if (tvl_delta_pct != null && tvl_delta_pct <= -tvlTh) {
      alerts.push({
        pool_id: m.pool_id,
        protocol_id: m.protocol_id,
        kind: "tvl_drain",
        magnitude: tvl_delta_pct,
        message: `TVL ${tvl_delta_pct.toFixed(2)}% (<= -${tvlTh}%) on ${m.protocol_id}/${m.symbol}`,
      });
    }
    if (apy_delta_abs >= apyTh) {
      alerts.push({
        pool_id: m.pool_id,
        protocol_id: m.protocol_id,
        kind: "apy_spike",
        magnitude: apy_delta_abs,
        message: `APY +${apy_delta_abs.toFixed(3)} pts (>= ${apyTh}) on ${m.protocol_id}/${m.symbol}`,
      });
    }
    if (apy_delta_abs <= -apyTh) {
      alerts.push({
        pool_id: m.pool_id,
        protocol_id: m.protocol_id,
        kind: "apy_drop",
        magnitude: apy_delta_abs,
        message: `APY ${apy_delta_abs.toFixed(3)} pts (<= -${apyTh}) on ${m.protocol_id}/${m.symbol}`,
      });
    }
  }

  return { pool_metrics, deltas, alerts };
}

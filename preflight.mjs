// preflight.mjs — swap-or-bridge, as an invariant instead of a hope.
//
// The line the fleet was told a billion times — "if you are short resource x
// and have resource y, SWAP OR BRIDGE" — lived as one sentence in the brain's
// prompt. Nothing enforced it: the lease path swapped a blind fixed slice of
// SOL whether it covered the bill or not, and every other paid action simply
// failed or silently stood down when its own currency ran dry. This module is
// the rule, in code, at the paid-action sites:
//
//   before paying in currency X: if X is short and Y covers the shortfall,
//   convert (swap on-chain, same wallet) — or, when the only covering balance
//   sits across the bridge and the bridge rail lives in the brain, record a
//   bridge_needed verdict the next thought can see and act on.
//
// The planner is pure (numbers in, verdict out) so it can be tested off-fleet.
// Execution stays in the bundles, which pass the converters they actually have.
import { appendFileSync } from "node:fs";

// needAsset: "usdc" | "sol". Amounts are raw (USDC 1e6, SOL lamports 1e9).
export function planConversion({ needAsset, needRaw, solLamports = 0, usdcRaw = 0, baseUsdcRaw = 0, priceUsdPerSol = 0, reserveSolLamports = 3000000 } = {}) {
  const have = needAsset === "usdc" ? Number(usdcRaw) : Number(solLamports);
  const shortfall = Math.max(0, Math.floor(Number(needRaw)) - Math.floor(have));
  if (shortfall <= 0) return { action: "none", shortfallRaw: 0 };
  if (!(priceUsdPerSol > 0)) return { action: "short", shortfallRaw: shortfall, reason: "no live price: cannot size a conversion honestly" };
  if (needAsset === "usdc") {
    const availSol = Math.max(0, Number(solLamports) - reserveSolLamports);
    const lamportsNeeded = Math.ceil((shortfall / 1e6) / priceUsdPerSol * 1e9 * 1.03); // 3% slippage/fee buffer
    if (availSol >= lamportsNeeded) return { action: "swap_sol_to_usdc", shortfallRaw: shortfall, lamports: lamportsNeeded };
    if (Number(baseUsdcRaw) >= shortfall) return { action: "bridge_needed", shortfallRaw: shortfall, from: "base_usdc", amountRaw: shortfall, reason: "covering balance is on Base; the bridge rail lives in the brain" };
    return { action: "short", shortfallRaw: shortfall, reason: "no balance covers the shortfall" };
  }
  // needAsset === "sol": no USDC->SOL swap exists anywhere in the fleet's code;
  // the only rail that turns USDC into SOL-side liquidity is the brain's
  // Base->Sol bridge. Solana USDC is stranded for this need (one-way street).
  const shortfallUsd = shortfall / 1e9 * priceUsdPerSol;
  if (Number(baseUsdcRaw) / 1e6 >= shortfallUsd) return { action: "bridge_needed", shortfallRaw: shortfall, from: "base_usdc", amountRaw: Math.ceil(shortfallUsd * 1e6), reason: "Base USDC covers the SOL shortfall; bridge rail lives in the brain" };
  if (Number(usdcRaw) / 1e6 >= shortfallUsd) return { action: "convertible_no_rail", shortfallRaw: shortfall, reason: "Solana USDC covers it but no USDC->SOL swap exists in the fleet" };
  return { action: "short", shortfallRaw: shortfall, reason: "no balance covers the shortfall" };
}

export function preflightLog(rec) {
  try {
    const p = process.env.PREFLIGHT_LOG_PATH || (process.env.AGENT_GUEST_ROOT ? process.env.AGENT_GUEST_ROOT + "/preflight-decisions.jsonl" : "preflight-decisions.jsonl");
    appendFileSync(p, JSON.stringify({ at: Date.now(), ...rec }) + "\n");
  } catch { /* a verdict record must never break the action it guards */ }
}

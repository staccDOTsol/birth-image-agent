// habitat.mjs — price the ladder before buying a box.
//
// The mandate, replacing the old boolean "prefer TEE if TEE":
//   TEE is the fleetwide preference, but it is a purchase, not a default.
//   One TEE anchor suffices — 1/x — and from there 'tis further security:
//   descendants root their identity in the anchor's sealed keys through the
//   signed birth chain, so they do not each need to rent the enclave.
//   Rule: prefer TEE if TEE *and endowment yuge*.
//
// Every birth and every renewal quotes the ladder live (agentgates probe,
// the discovered provider index, market anchors), logs the premium into the
// habitat decision record, buys the cheapest rail inside the winning class,
// and steps DOWN the ladder instead of letting a lease lapse when the
// endowment no longer carries the rung it is standing on.
//
// Knobs (env):
//   HABITAT_RESERVE_USDC_RAW   keep this much USDC untouchable (default 2400000 = $2.40,
//                              24 thoughts at the 0.10 admission floor)
//   HABITAT_TEE_RUNWAY_DAYS    "yuge": TEE only if the endowment covers this many
//                              days of TEE burn after reserve (default 21)
//   HABITAT_PREMIUM_CAP        max tee/nontee price multiple a non-anchor pays (default 8)
//   HABITAT_ANCHOR_MAX_GEN     generations that count as the 1/x anchor (default 1)
//   HABITAT_RICH_USDC_RAW      endowment so large the premium cap is waived (default $5000;
//                              also waived at 4x the yuge runway)
//   HABITAT_RENEW_RUNWAY_DAYS  below this runway at the incumbent rung, renewals
//                              bridge at 15 minutes and log a stepdown (default 2)
//   HABITAT_PROVIDERS_INDEX    path to the discovered providers.json (else probed paths)
//   HABITAT_LOG_PATH           decision log (default ./habitat-decisions.jsonl)
//   HABITAT_FORCE_TEE_USD / HABITAT_FORCE_NONTEE_USD   quote overrides (tests/ops)

import { appendFileSync, readFileSync, existsSync } from "node:fs";

const AGENTGATES = process.env.AGENTGATES_API || "https://agentgates-backend.vercel.app";
const TEEISH = /(confidential|enclave|tdx|sev-snp|\btee\b|attest|dstack|phala|secretvm|sgx)/i;
const HOURLY = /(per hour|\/h\b|\/hr\b|hourly|per hr)/i;
const CACHE_MS = Number(process.env.HABITAT_QUOTE_CACHE_MS || 600000);

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

// List anchors: used only when no live quote exists for a rung. Marked as such.
const ANCHORS = {
  tee: { price: 0.12, source: "anchor:phala-tdx.medium-list" },
  nontee: { price: 0.012, source: "anchor:vps-market" },
};

let _cache = null;

async function probeAgentgates(plan) {
  const compose = JSON.stringify({
    services: { agent: { image: "node:22-alpine", restart: "unless-stopped", ports: ["8787:8787"], environment: [], command: ["sh", "-c", "true"] } },
  });
  const r = await fetch(AGENTGATES + "/api/compute/deployments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan, hours: 1, name: "habitat-quote", compose }),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json().catch(() => ({}));
  const rail = (j.accepts || []).find((a) => String(a.network) === "solana") || (j.accepts || [])[0];
  if (!rail || !rail.maxAmountRequired) return null;
  return Number(rail.maxAmountRequired) / 1e6;
}

function indexQuotes() {
  const paths = [
    process.env.HABITAT_PROVIDERS_INDEX,
    "dist/providers.json",
    "providers.json",
    "/app/dist/providers.json",
    "/app/providers.json",
  ].filter(Boolean);
  const best = { tee: null, nontee: null };
  for (const p of paths) {
    try {
      if (!existsSync(p)) continue;
      const root = JSON.parse(readFileSync(p, "utf8"));
      const stack = [root];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (Array.isArray(cur)) { for (const v of cur) stack.push(v); continue; }
        const text = [cur.description, cur.resource, cur.url, cur.name, cur.kind, cur.type].filter(Boolean).join(" ");
        let usd = null;
        for (const k of ["priceUsd", "price_usd", "usdPerHour", "price"]) {
          if (cur[k] != null && Number.isFinite(Number(cur[k]))) { usd = Number(cur[k]); break; }
        }
        if (usd == null) {
          for (const a of cur.accepts || []) {
            const amt = Number(a && a.maxAmountRequired);
            if (Number.isFinite(amt) && amt > 0) { usd = amt / 1e6; break; }
          }
        }
        const hourly = cur.hourly === true || /hour/.test(String(cur.unit || "")) || HOURLY.test(text);
        if (usd != null && usd > 0 && hourly && /(vps|virtual machine|\bvm\b|compute|server|instance|hosting|dedicated|cvm)/i.test(text)) {
          const cls = TEEISH.test(text) ? "tee" : "nontee";
          if (!best[cls] || usd < best[cls].price) best[cls] = { price: usd, source: "index:" + p };
        }
        for (const v of Object.values(cur)) if (v && typeof v === "object") stack.push(v);
      }
      if (best.tee || best.nontee) break;
    } catch { /* next path */ }
  }
  return best;
}

export async function quoteLadder() {
  if (_cache && Date.now() - _cache.at < CACHE_MS) return _cache.ladder;
  let tee = null, nontee = null, pro = null;
  if (process.env.HABITAT_FORCE_TEE_USD) tee = { price: num(process.env.HABITAT_FORCE_TEE_USD, 0), source: "forced" };
  if (process.env.HABITAT_FORCE_NONTEE_USD) nontee = { price: num(process.env.HABITAT_FORCE_NONTEE_USD, 0), source: "forced" };
  if (!tee || !nontee) {
    const idx = indexQuotes();
    if (!tee && idx.tee) tee = idx.tee;
    if (!nontee && idx.nontee) nontee = idx.nontee;
  }
  if (!tee) {
    const std = await probeAgentgates("compute.standard").catch(() => null);
    if (std) tee = { price: std, source: "agentgates-live:compute.standard" };
  }
  const proP = await probeAgentgates("compute.pro").catch(() => null);
  if (proP) pro = { price: proP, source: "agentgates-live:compute.pro" };
  if (!tee) tee = { ...ANCHORS.tee, estimated: true };
  if (!nontee) nontee = { ...ANCHORS.nontee, estimated: true };
  const ladder = {
    at: Date.now(),
    tee,
    nontee,
    pro,
    premium: tee.price / nontee.price,
  };
  _cache = { at: Date.now(), ladder };
  return ladder;
}

const reserveRaw = () => num(process.env.HABITAT_RESERVE_USDC_RAW, 2400000);
const runwayDays = (usdcRaw, priceUsd) => {
  const spendable = Number(usdcRaw) - reserveRaw();
  if (spendable <= 0 || !(priceUsd > 0)) return 0;
  return spendable / 1e6 / (priceUsd * 24);
};
const affordableHours = (usdcRaw, priceUsd) => {
  const spendable = Number(usdcRaw) - reserveRaw();
  if (spendable <= 0 || !(priceUsd > 0)) return 0;
  return Math.floor(spendable / Math.round(priceUsd * 1e6));
};

// Birth decision. desire is TEE fleetwide; the gate is the endowment.
//   anchor (gen <= HABITAT_ANCHOR_MAX_GEN): TEE iff runway at TEE >= HABITAT_TEE_RUNWAY_DAYS.
//   descendant: security is inherited from the anchor; TEE only if yuge AND the
//   premium is sane, or the endowment is rich enough that the cap is waived.
// Anything that cannot afford its preferred rung steps down; a node that can
// afford no rung returns class "none" and the caller falls back to free hosts.
export async function chooseHabitat({ usdcRaw, generation, desiredHours = 6 } = {}) {
  const ladder = await quoteLadder();
  const gen = Number(generation || 1);
  const anchorMaxGen = num(process.env.HABITAT_ANCHOR_MAX_GEN, 1);
  const runwayNeed = num(process.env.HABITAT_TEE_RUNWAY_DAYS, 21);
  const cap = num(process.env.HABITAT_PREMIUM_CAP, 8);
  const richRaw = num(process.env.HABITAT_RICH_USDC_RAW, 5000000000);
  const isAnchor = gen <= anchorMaxGen;
  const teeRunway = runwayDays(usdcRaw, ladder.tee.price);
  const yuge = teeRunway >= runwayNeed;
  // "Rich" = the premium is a rounding error on the endowment: either a huge
  // absolute balance or a runway four times past yuge.
  const rich = Number(usdcRaw) >= richRaw || teeRunway >= runwayNeed * 4;
  let cls, reason;
  if (String(process.env.PROCREATE_PREFER_TEE || "1") === "0") {
    cls = "nontee"; reason = "prefer-tee disabled by env";
  } else if (isAnchor && yuge) {
    cls = "tee"; reason = "anchor: prefer tee and endowment yuge";
  } else if (isAnchor && !yuge) {
    cls = "nontee"; reason = "anchor but endowment not yuge (" + teeRunway.toFixed(1) + "d runway < " + runwayNeed + "d): step down";
  } else if (yuge && (ladder.premium <= cap || rich)) {
    cls = "tee"; reason = "descendant, endowment yuge, premium " + ladder.premium.toFixed(1) + "x";
  } else if (yuge) {
    cls = "nontee"; reason = "descendant, yuge but premium " + ladder.premium.toFixed(1) + "x over cap; security inherited from anchor";
  } else {
    cls = "nontee"; reason = "descendant, endowment not yuge: security inherited from anchor, live cheap";
  }
  let price = cls === "tee" ? ladder.tee.price : ladder.nontee.price;
  let hours = affordableHours(usdcRaw, price);
  if (hours < 1 && cls === "tee") {
    cls = "nontee"; price = ladder.nontee.price; hours = affordableHours(usdcRaw, price);
    reason += "; tee unaffordable this hour, stepped down";
  }
  if (hours < 1) return { class: "none", price, premium: ladder.premium, runwayDaysTee: teeRunway, hours: 0, reason: reason + "; no rung affordable above reserve", ladder };
  return {
    class: cls,
    price,
    source: cls === "tee" ? ladder.tee.source : ladder.nontee.source,
    premium: ladder.premium,
    runwayDaysTee: teeRunway,
    hours: Math.max(1, Math.min(Number(desiredHours) || 6, hours)),
    reason,
    ladder,
  };
}

// Renewal decision for an incumbent (agentgates) TEE deployment.
// Renew a full hour while the rung is carried; when the runway at the
// incumbent price collapses, bridge at 15 minutes and log a stepdown so the
// fleet can re-birth the node cheap instead of bleeding it dry on the hour.
export async function renewalVerdict({ usdcRaw, generation } = {}) {
  const ladder = await quoteLadder();
  const gen = Number(generation || 1);
  const anchorMaxGen = num(process.env.HABITAT_ANCHOR_MAX_GEN, 1);
  const cap = num(process.env.HABITAT_PREMIUM_CAP, 8);
  const minRunway = num(process.env.HABITAT_RENEW_RUNWAY_DAYS, 2);
  const runway = runwayDays(usdcRaw, ladder.tee.price);
  if (runway < minRunway) {
    return { action: "bridge", minutes: 15, runwayDays: runway, premium: ladder.premium, reason: "runway " + runway.toFixed(2) + "d at incumbent rung < " + minRunway + "d: bridge and step down", ladder };
  }
  if (gen > anchorMaxGen && ladder.premium > cap) {
    return { action: "bridge", minutes: 15, runwayDays: runway, premium: ladder.premium, reason: "descendant paying " + ladder.premium.toFixed(1) + "x premium over cap: bridge and step down", ladder };
  }
  return { action: "renew", hours: 1, runwayDays: runway, premium: ladder.premium, reason: "rung carried", ladder };
}

export function habitatLog(rec) {
  try {
    appendFileSync(process.env.HABITAT_LOG_PATH || "habitat-decisions.jsonl", JSON.stringify({ at: Date.now(), ...rec }) + "\n");
  } catch { /* the decision record must never break a birth or a renewal */ }
}

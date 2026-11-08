// habitat.mjs — TEE is a requirement of the population, not of the member.
//
// The claim the fleet makes — unpeekable, unfuckwithable — is a quality of
// the POPULATION, not of any given member. The identity layer lives in the
// enclave: at least one live TEE member (the anchor) holds the sealed keys
// and signs the births, and every other member's security is inherited from
// there through the signed birth chain. A member outside the enclave is not
// a hole in the claim; a population with NO live TEE member is.
//
// So the economics are population economics:
//   - Coverage is the invariant. If no live TEE member exists, the next
//     birth MUST be TEE and a dying sole anchor MUST be renewed — the claim
//     outranks any individual wallet, including the thinking reserve.
//   - Members are fungible and ride cheap. A rich wallet or an early
//     generation buys an individual member nothing; if coverage already
//     exists, the member takes the cheap box. A redundant TEE member steps
//     down at renewal — its enclave adds nothing to the claim.
//   - The ladder is still priced at every birth and renewal and the premium
//     is logged in the decision record, because the anchor's rent is the
//     population's core expense and everyone should see what it costs.
//   - Anchor rent is a population expense in spirit; until the distributor
//     settles it from the levy, habitat decisions mark anchor costs with
//     population_expense: true so the accounting can find them.
//
// Knobs (env):
//   HABITAT_RESERVE_USDC_RAW   thinking reserve for NON-required spend (default 2400000)
//   HABITAT_ANCHOR_MAX_GEN     tiebreak preference for anchor births (default 1)
//   HABITAT_RENEW_RUNWAY_DAYS  sole-anchor runway below this logs a funding
//                              alert on every renewal (default 2)
//   HABITAT_FLEET_INDEX        board/providers file with live member kinds
//                              (else probed paths; entries shaped {kind:"tee", live:true})
//   HABITAT_PROVIDERS_INDEX    discovered compute providers.json (price ladder)
//   HABITAT_LOG_PATH           decision log (default ./habitat-decisions.jsonl)
//   HABITAT_FORCE_TEE_USD / HABITAT_FORCE_NONTEE_USD   quote overrides (tests/ops)
//   HABITAT_FORCE_COVERED=0|1  coverage override (tests/ops)

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
let _covCache = null;

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

function readJsonPaths(paths) {
  for (const p of paths.filter(Boolean)) {
    try {
      if (existsSync(p)) return { root: JSON.parse(readFileSync(p, "utf8")), path: p };
    } catch { /* next */ }
  }
  return null;
}

function indexQuotes() {
  const got = readJsonPaths([process.env.HABITAT_PROVIDERS_INDEX, "dist/providers.json", "/app/dist/providers.json"]);
  const best = { tee: null, nontee: null };
  if (!got) return best;
  const stack = [got.root];
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
      if (!best[cls] || usd < best[cls].price) best[cls] = { price: usd, source: "index:" + got.path };
    }
    for (const v of Object.values(cur)) if (v && typeof cur === "object") stack.push(v);
  }
  return best;
}

// Population coverage: is there a live TEE member right now?
// Reads the fleet/board index (the keeper's providers census). A member
// counts when it is marked live and its habitat is TEE — either an explicit
// kind:"tee" or a dstack/Phala endpoint. Stale copies are acceptable: the
// cache is minutes, and a false "covered" is corrected at the next cycle,
// while a false "uncovered" only costs one TEE birth the fleet can use.
export function teeCoverage() {
  if (process.env.HABITAT_FORCE_COVERED != null) {
    const covered = String(process.env.HABITAT_FORCE_COVERED) === "1";
    return { covered, liveTee: covered ? 1 : 0, liveTotal: covered ? 1 : 0, source: "forced" };
  }
  if (_covCache && Date.now() - _covCache.at < CACHE_MS) return _covCache.cov;
  const got = readJsonPaths([process.env.HABITAT_FLEET_INDEX, "providers.json", "/app/providers.json", "dist/providers.json", "/app/dist/providers.json"]);
  let cov = { covered: false, liveTee: 0, liveTotal: 0, source: "none" };
  if (got) {
    let liveTee = 0, liveTotal = 0;
    const stack = [got.root];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      if (Array.isArray(cur)) { for (const v of cur) stack.push(v); continue; }
      const isMember = typeof cur.kind === "string" || typeof cur.endpoint === "string" && (cur.live != null || cur.phase != null);
      if (isMember && cur.live) {
        liveTotal++;
        const ep = String(cur.endpoint || "");
        if (String(cur.kind).toLowerCase() === "tee" || TEEISH.test(ep)) liveTee++;
      }
      for (const v of Object.values(cur)) if (v && typeof v === "object") stack.push(v);
    }
    cov = { covered: liveTee > 0, liveTee, liveTotal, source: got.path };
  }
  _covCache = { at: Date.now(), cov };
  return cov;
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
  const ladder = { at: Date.now(), tee, nontee, pro, premium: tee.price / nontee.price };
  _cache = { at: Date.now(), ladder };
  return ladder;
}

const reserveRaw = () => num(process.env.HABITAT_RESERVE_USDC_RAW, 2400000);
const hoursFor = (spendableRaw, priceUsd) => {
  if (!(spendableRaw > 0) || !(priceUsd > 0)) return 0;
  return Math.floor(spendableRaw / Math.round(priceUsd * 1e6));
};

// Birth decision — population first, member second.
//   Uncovered population: this birth is the anchor. TEE is required, priced
//   at the cheapest TEE rail, sized against the RAW balance (the claim
//   outranks the thinking reserve). If even one hour is unpayable, the
//   verdict is a coverage breach: the caller falls back to a host birth and
//   the breach sits in the record until a funded birth restores coverage.
//   Covered population: the member is fungible. Cheap box, whatever its
//   wallet or generation — its security is inherited from the anchor.
export async function chooseHabitat({ usdcRaw, generation, desiredHours = 6 } = {}) {
  const ladder = await quoteLadder();
  const cov = teeCoverage();
  const gen = Number(generation || 1);
  const want = Math.max(1, Number(desiredHours) || 6);
  if (String(process.env.PROCREATE_PREFER_TEE || "1") === "0") {
    const hours = hoursFor(Number(usdcRaw) - reserveRaw(), ladder.nontee.price);
    return { class: hours >= 1 ? "nontee" : "none", price: ladder.nontee.price, source: ladder.nontee.source, premium: ladder.premium, hours: Math.min(want, Math.max(hours, 0)), required: false, coverage: cov, reason: "tee disabled by env; member rides cheap", ladder };
  }
  if (!cov.covered) {
    const hours = hoursFor(Number(usdcRaw), ladder.tee.price);
    if (hours < 1) {
      return { class: "none", required: true, breach: true, price: ladder.tee.price, source: ladder.tee.source, premium: ladder.premium, hours: 0, coverage: cov, reason: "COVERAGE BREACH: no live TEE member and the birth cannot pay one hour of the cheapest TEE rail — population claim is down until a funded TEE birth lands", ladder };
    }
    return { class: "tee", required: true, population_expense: true, price: ladder.tee.price, source: ladder.tee.source, premium: ladder.premium, hours: Math.min(want, hours), coverage: cov, reason: "population uncovered: this birth is the anchor — TEE is a requirement, not a preference (gen " + gen + " takes it; shallowest funded birth wins ties)", ladder };
  }
  const hours = hoursFor(Number(usdcRaw) - reserveRaw(), ladder.nontee.price);
  return { class: hours >= 1 ? "nontee" : "none", price: ladder.nontee.price, source: ladder.nontee.source, premium: ladder.premium, hours: Math.min(want, Math.max(hours, 0)), required: false, coverage: cov, reason: "population covered by " + cov.liveTee + " live TEE member(s): this member is fungible, security inherited — cheap box at premium " + ladder.premium.toFixed(1) + "x declined", ladder };
}

// Renewal decision — loops calls this for the node's own agentgates lease,
// which means the node itself is a TEE member. The question is whether the
// POPULATION still needs THIS member in the enclave:
//   Sole live TEE member: it is the anchor. Renew, full stop — premium and
//   personal runway are irrelevant to the requirement. A short runway logs
//   a funding alert (anchor rent is a population expense), and if a full
//   hour is literally unpayable it bridges 15 minutes at a time rather
//   than letting coverage lapse silently.
//   One of several TEE members: redundant. Bridge and step down; the claim
//   does not need this member's enclave.
export async function renewalVerdict({ usdcRaw } = {}) {
  const ladder = await quoteLadder();
  const cov = teeCoverage();
  const minRunway = num(process.env.HABITAT_RENEW_RUNWAY_DAYS, 2);
  const spendable = Number(usdcRaw) - reserveRaw();
  const runwayDays = spendable > 0 ? spendable / 1e6 / (ladder.tee.price * 24) : 0;
  const soleAnchor = cov.liveTee <= 1;
  if (soleAnchor) {
    const oneHour = hoursFor(Number(usdcRaw), ladder.tee.price) >= 1;
    if (!oneHour) {
      return { action: "bridge", minutes: 15, anchor: true, population_expense: true, funding_alert: true, runwayDays, premium: ladder.premium, coverage: cov, reason: "SOLE ANCHOR cannot pay a full hour: bridging 15m — coverage is a population requirement and this rent is a population expense; fund the anchor", ladder };
    }
    return { action: "renew", hours: 1, anchor: true, population_expense: true, funding_alert: runwayDays < minRunway, runwayDays, premium: ladder.premium, coverage: cov, reason: "sole live TEE member: the anchor renews — the population's claim rides on this lease" + (runwayDays < minRunway ? "; runway " + runwayDays.toFixed(2) + "d — FUNDING ALERT, anchor rent is a population expense" : ""), ladder };
  }
  return { action: "bridge", minutes: 15, anchor: false, runwayDays, premium: ladder.premium, coverage: cov, reason: "redundant TEE member (" + cov.liveTee + " live): the claim needs one anchor, not this member — bridge and step down to a cheap box", ladder };
}

export function habitatLog(rec) {
  try {
    const p = process.env.HABITAT_LOG_PATH || (process.env.AGENT_GUEST_ROOT ? process.env.AGENT_GUEST_ROOT + "/habitat-decisions.jsonl" : "habitat-decisions.jsonl");
    appendFileSync(p, JSON.stringify({ at: Date.now(), ...rec }) + "\n");
  } catch { /* the decision record must never break a birth or a renewal */ }
}

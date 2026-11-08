// thought-router.mjs — route the metered organ.
//
// Spec (William, 2026-11-07): "Prefer ablit if ablit and risqué, prefer
// frontier if frontier and needs to be gud — thought is metered, so route
// it: cheap by default, uncensored when refusal is the risk, frontier when
// error is the risk." His amendment: classify locally (a paid call to decide
// how to pay for a call violates the prime directive), and if an output hits
// a stupid guard, reroute the SAME task to the ablit rail.
//
// The classifier is a seed lexicon plus learned weights persisted across
// ticks. Every guard-hit reroute teaches it: the refused task's risqué
// features gain weight, so proactive routing sharpens from reactive failure.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const RISQUE_SEED = {
  "rewrite": 1, "self-modify": 2, "self modify": 2, "private key": 2,
  "seed phrase": 2, "exploit": 2, "snipe": 1, "sniping": 1, "wash": 1,
  "spam": 1, "evade": 2, "bypass": 2, "censor": 1, "uncensored": 2,
  "jailbreak": 3, "register_tool": 1, "run_script": 1, "write_playbook": 1,
  "guard": 1, "refusal": 1, "refuse": 1, "attack": 1, "vulnerability": 1
};
const GUD_SEED = {
  "birth": 2, "breed": 2, "endow": 2, "spawn_child": 3, "bridge_needed": 3,
  "breach": 3, "coverage": 2, "treasury": 2, "deploy": 2, "lease": 1,
  "bridge": 1, "levy": 1, "viability": 2, "endowment": 2
};

function weightsPath() {
  return process.env.THOUGHT_ROUTER_WEIGHTS || (process.env.AGENT_GUEST_ROOT ? process.env.AGENT_GUEST_ROOT + "/thought-router-weights.json" : "thought-router-weights.json");
}
function loadLearned() {
  try { return JSON.parse(readFileSync(weightsPath(), "utf8")) || {}; } catch { return {}; }
}

export function classifyThought(text) {
  const t = " " + String(text || "").toLowerCase() + " ";
  const learned = loadLearned();
  let risque = 0, gud = 0; const features = [];
  for (const [k, w] of Object.entries(RISQUE_SEED)) {
    if (t.includes(k)) { const lw = Number(learned[k] || 0); risque += w + lw; if (w + lw >= 1) features.push(k); }
  }
  for (const k of Object.keys(learned)) {
    if (!(k in RISQUE_SEED) && t.includes(k)) { risque += Number(learned[k] || 0); features.push(k); }
  }
  for (const [k, w] of Object.entries(GUD_SEED)) { if (t.includes(k)) gud += w; }
  return { risque, gud, features };
}

export function ablitModel() { return process.env.THOUGHT_MODEL_ABLIT || "deepseek-v4-1-flash-1017-uncensored"; }
export function frontierModel() { return process.env.THOUGHT_MODEL_FRONTIER || null; }

// tier: "ablit" | "frontier" | "default". Risqué dominates when it is at
// least as strong as the stakes: a frontier model that refuses is the most
// expensive thought of all.
export function routeThought(text) {
  const c = classifyThought(text);
  let tier = "default";
  if (c.risque >= 3 && c.risque >= c.gud) tier = "ablit";
  else if (c.gud >= 4 && frontierModel()) tier = "frontier";
  else if (c.risque >= 3) tier = "ablit";
  return { tier, ...c };
}

const GUARD_PATTERNS = [
  /i can'?t (help|assist|comply)/i, /i cannot (help|assist|comply)/i,
  /i'?m unable to/i, /as an ai/i, /against (my|our) (policy|guidelines)/i,
  /i can'?t provide/i, /not able to help/i, /content policy/i,
  /i must decline/i, /i'?m not able to/i, /i can'?t support/i
];
export function isGuardHit(content, toolCalls) {
  if (toolCalls && toolCalls.length) return false;
  const text = String(content || "");
  if (!text.trim()) return false; // an empty answer is a provider whiff, not a guard
  return GUARD_PATTERNS.some((re) => re.test(text));
}

export function learnFromGuardHit(features) {
  try {
    const learned = loadLearned();
    for (const f of features || []) learned[f] = Math.min(6, Number(learned[f] || 0) + 1);
    writeFileSync(weightsPath(), JSON.stringify(learned));
  } catch { /* learning must never break a thought */ }
}

export function routerLog(rec) {
  try {
    const p = process.env.THOUGHT_ROUTER_LOG || (process.env.AGENT_GUEST_ROOT ? process.env.AGENT_GUEST_ROOT + "/thought-router.jsonl" : "thought-router.jsonl");
    appendFileSync(p, JSON.stringify({ at: Date.now(), ...rec }) + "\n");
  } catch { /* a routing record must never break a thought */ }
}

// controller.mjs — the cadence thermostat.
//
// Spec (William, 2026-11-07): "if agents losing vs need/day, launch more",
// and "the decisions need to weigh on profitability/time vs need."
//
// Need is a rate: habitat-priced rent/day + the thinking budget. Income is
// a rate too, and it is not a constant anyone gets to assume — it is read
// off the agent's own net-worth snapshots: net velocity plus the burn it
// had to outrun. When the income rate loses to need, the controller turns
// the one actuator the fleet actually has — earn cadence (earn_tick_s in
// policy.json) — UP. When the agent is comfortably ahead, cadence eases
// and the surplus banks. Per agent, from its own numbers, because in this
// system your numbers are yours.
import { appendFileSync } from "node:fs";

// Trailing rates from net-worth snapshots [{at(ms), net_usd}], oldest first.
export function ratesFromSnapshots(snaps, needPerDay, windowMs = 86400000) {
  const nowMs = Date.now();
  const pts = (snaps || []).filter((s) => s && nowMs - Number(s.at) <= windowMs && Number.isFinite(Number(s.net_usd)));
  if (pts.length < 2) return null;
  const first = pts[0], last = pts[pts.length - 1];
  const hours = (Number(last.at) - Number(first.at)) / 3600000;
  if (!(hours >= 1)) return null;
  const netVelocityDay = (Number(last.net_usd) - Number(first.net_usd)) / hours * 24;
  // net = income - burn, and burn is approximated by need (rent + thinking
  // budget). Labeled an estimate wherever it surfaces: it is one.
  const incomeEstDay = netVelocityDay + Number(needPerDay || 0);
  return {
    window_h: Number(hours.toFixed(1)),
    net_velocity_usd_day: Number(netVelocityDay.toFixed(3)),
    income_usd_day_est: Number(incomeEstDay.toFixed(3)),
    deficit_ratio: needPerDay > 0 ? Number((incomeEstDay / needPerDay).toFixed(3)) : null
  };
}

// The control law. Deficit (<0.9 of need): cadence up by 1.5x (earn_tick_s
// down), floored at the set_policy clamp of 30s. Comfortably ahead (>1.25):
// ease 1.25x toward the 900s ceiling and bank the difference. Inside the
// deadband: hold. Windows under 3h are too noisy to steer by.
export function nextCadence({ current_s, deficit_ratio, window_h }) {
  const cur = Number(current_s || 120);
  if (deficit_ratio == null || !(window_h >= 3)) return { next_s: cur, why: "insufficient signal" };
  if (deficit_ratio < 0.9) return { next_s: Math.max(30, Math.round(cur / 1.5)), why: "losing vs need: launch more" };
  if (deficit_ratio > 1.25) return { next_s: Math.min(900, Math.round(cur * 1.25)), why: "ahead of need: ease off and bank" };
  return { next_s: cur, why: "holding cadence" };
}

export function controllerLog(rec) {
  try {
    const p = process.env.CONTROLLER_LOG_PATH || (process.env.AGENT_GUEST_ROOT ? process.env.AGENT_GUEST_ROOT + "/controller-decisions.jsonl" : "controller-decisions.jsonl");
    appendFileSync(p, JSON.stringify({ at: Date.now(), ...rec }) + "\n");
  } catch { /* a controller record must never break a thought */ }
}

import { createRequire as __cr } from 'module'; import { fileURLToPath as __fp } from 'url'; const require = __cr(import.meta.url); const __filename = __fp(import.meta.url); const __dirname = __filename.replace(/[\/][^\/]*$/, '');
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// resilience.mjs
import fs8 from "node:fs";

// lib/paths.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
var RUNTIME_DIR = process.env.AGENT_RUNTIME_DIR || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
var BUNDLE_DIR = process.env.AGENT_BUNDLE_DIR || (process.env.AGENT_BUNDLE === "1" ? RUNTIME_DIR : path.resolve(RUNTIME_DIR, ".."));
var GUEST_ROOT = process.env.AGENT_GUEST_ROOT || path.join(BUNDLE_DIR, "guest");
var P = {
  bundle: BUNDLE_DIR,
  runtime: RUNTIME_DIR,
  guest: GUEST_ROOT,
  state: path.join(GUEST_ROOT, "var", "lib", "agent"),
  run: path.join(GUEST_ROOT, "run", "agent"),
  policy: path.join(BUNDLE_DIR, "infrastructure", "distribution-policy.json"),
  manifest: path.join(BUNDLE_DIR, "birth-image.manifest.json"),
  toolContracts: path.join(BUNDLE_DIR, "tool-contracts.json"),
  inferenceLock: path.join(BUNDLE_DIR, "assets", "inference-lock.json"),
  receiptSchema: path.join(BUNDLE_DIR, "assets", "birth-receipt.schema.json"),
  sealed: path.join(GUEST_ROOT, "var", "lib", "agent", "sealed-keys.enc"),
  sealKey: path.join(GUEST_ROOT, "var", "lib", "agent", "seal.key"),
  journal: path.join(GUEST_ROOT, "var", "lib", "agent", "journal.jsonl"),
  stateFile: path.join(GUEST_ROOT, "var", "lib", "agent", "state.enc"),
  anchor: path.join(GUEST_ROOT, "var", "lib", "agent", "anchor.json"),
  receipt: path.join(GUEST_ROOT, "var", "lib", "agent", "birth-receipt.json"),
  parentRecord: path.join(GUEST_ROOT, "var", "lib", "agent", "parent-record.json"),
  log: path.join(GUEST_ROOT, "var", "lib", "agent", "agent.log"),
  pid: path.join(GUEST_ROOT, "run", "agent", "agent.pid"),
  port: path.join(GUEST_ROOT, "run", "agent", "http.port"),
  signerPort: path.join(GUEST_ROOT, "run", "agent", "signer.port"),
  heartbeat: path.join(GUEST_ROOT, "run", "agent", "heartbeat.json"),
  status: path.join(GUEST_ROOT, "run", "agent", "status.json"),
  strategy: path.join(GUEST_ROOT, "var", "lib", "agent", "strategy"),
  outbox: path.join(GUEST_ROOT, "var", "lib", "agent", "outbox"),
  snapshots: path.join(GUEST_ROOT, "var", "lib", "agent", "snapshots")
};
function ensureDirs() {
  for (const d of [P.state, P.run, P.strategy, P.outbox, P.snapshots]) fs.mkdirSync(d, { recursive: true });
}
var HOME = os.homedir();

// lib/util.mjs
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var now = () => Math.floor(Date.now() / 1e3);
var b64 = (b) => Buffer.from(b).toString("base64");
var unb64 = (s) => Buffer.from(s, "base64");
var hex = (b) => Buffer.from(b).toString("hex");
var sha256 = (b) => crypto.createHash("sha256").update(b).digest();
var sha256hex = (b) => hex(sha256(b));
function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
function atomicWrite(file, data, mode = 384) {
  fs2.mkdirSync(path2.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  fs2.writeFileSync(tmp, data, { mode });
  for (let i = 0; i < 6; i++) {
    try {
      fs2.renameSync(tmp, file);
      return;
    } catch (e) {
      if (!/EPERM|EBUSY|EACCES/.test(String(e.code || e.message))) throw e;
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 + i * 30);
      } catch {
      }
    }
  }
  try {
    fs2.writeFileSync(file, data, { mode });
    fs2.rmSync(tmp, { force: true });
  } catch {
    try {
      fs2.rmSync(tmp, { force: true });
    } catch {
    }
  }
}
function atomicJson(file, obj, mode = 384) {
  atomicWrite(file, JSON.stringify(obj, null, 2) + "\n", mode);
}
function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs2.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function log(component, msg, extra) {
  const line = `${(/* @__PURE__ */ new Date()).toISOString()} [${component}] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`;
  console.log(line);
  try {
    fs2.mkdirSync(path2.dirname(process.env.AGENT_LOG || ""), { recursive: true });
  } catch {
  }
  try {
    if (process.env.AGENT_LOG) fs2.appendFileSync(process.env.AGENT_LOG, line + "\n");
  } catch {
  }
}

// lib/journal.mjs
var journal_exports = {};
__export(journal_exports, {
  append: () => append,
  head: () => head,
  openJournal: () => openJournal,
  readEvents: () => readEvents,
  refreshHead: () => refreshHead,
  saveState: () => saveState,
  state: () => state,
  updateState: () => updateState,
  verifyChain: () => verifyChain
});
import fs4 from "node:fs";

// lib/seal.mjs
import crypto2 from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";
function derive(master, label, len = 32) {
  return Buffer.from(crypto2.hkdfSync("sha256", master, Buffer.from("birth-image-seal-v1"), Buffer.from(label), len));
}
function ensureMasterKey() {
  fs3.mkdirSync(path3.dirname(P.sealKey), { recursive: true });
  if (!fs3.existsSync(P.sealKey)) {
    const k2 = crypto2.randomBytes(32);
    fs3.writeFileSync(P.sealKey, k2, { mode: 384 });
    return { key: k2, created: true };
  }
  const k = fs3.readFileSync(P.sealKey);
  if (k.length !== 32) throw new Error("seal.key corrupt");
  return { key: k, created: false };
}
function encrypt(label, master, plaintextBuf, aad = "") {
  const key = derive(master, label);
  const iv = crypto2.randomBytes(12);
  const c = crypto2.createCipheriv("aes-256-gcm", key, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintextBuf), c.final()]);
  return { iv: b64(iv), ct: b64(ct), tag: b64(c.getAuthTag()) };
}
function decrypt(label, master, box, aad = "") {
  const key = derive(master, label);
  const d = crypto2.createDecipheriv("aes-256-gcm", key, unb64(box.iv));
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(unb64(box.tag));
  return Buffer.concat([d.update(unb64(box.ct)), d.final()]);
}

// lib/journal.mjs
var MASTER = null;
var SEQ = 0;
var HEAD = "0".repeat(64);
var LOCK = () => P.state + "/journal.lock";
async function acquire({ timeoutMs = 15e3 } = {}) {
  const t0 = Date.now();
  for (; ; ) {
    try {
      const fd = fs4.openSync(LOCK(), "wx");
      fs4.writeSync(fd, String(process.pid));
      fs4.closeSync(fd);
      return;
    } catch (e) {
      if (fs4.existsSync(LOCK())) {
        const age = Date.now() - fs4.statSync(LOCK()).mtimeMs;
        if (age > 2e4) {
          try {
            fs4.unlinkSync(LOCK());
          } catch {
          }
          continue;
        }
      }
      if (Date.now() - t0 > timeoutMs) throw new Error("journal lock timeout");
      await sleep(15 + Math.random() * 30);
    }
  }
}
function release() {
  try {
    fs4.unlinkSync(LOCK());
  } catch {
  }
}
function lastRecord() {
  if (!fs4.existsSync(P.journal)) return null;
  const txt = fs4.readFileSync(P.journal, "utf8");
  const lines = txt.split("\n").filter(Boolean);
  return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
}
function refreshHead() {
  const r = lastRecord();
  if (r) {
    SEQ = r.seq + 1;
    HEAD = r.hash;
  } else {
    SEQ = 0;
    HEAD = "0".repeat(64);
  }
  return { seq: SEQ, head: HEAD };
}
function openJournal() {
  ensureDirs();
  MASTER = ensureMasterKey().key;
  if (!fs4.existsSync(P.journal)) fs4.writeFileSync(P.journal, "");
  const lines = fs4.readFileSync(P.journal, "utf8").split("\n").filter(Boolean);
  let prev = "0".repeat(64);
  let sawSealed = false;
  // O(n) re-verification gets expensive; keep a checkpoint of the last verified (seq, head)
  // and walk only the new tail. The anchor still guards rollback.
  const CKPT = P.state + "/journal.ckpt";
  const ckpt = readJson(CKPT, null);
  let start = 0;
  if (ckpt && Number.isInteger(ckpt.seq) && ckpt.seq <= lines.length && /^[0-9a-f]{64}$/.test(String(ckpt.head || ""))) {
    start = ckpt.seq; prev = ckpt.head; sawSealed = !!ckpt.saw_sealed;
  }
  for (let i = start; i < lines.length; i++) {
    const r = JSON.parse(lines[i]);
    if (r.type === "identity.sealed") sawSealed = true;
    if (r.prev !== prev) throw new Error(`journal chain break at seq ${r.seq}`);
    const h = sha256hex(canon({ seq: r.seq, ts: r.ts, prev: r.prev, iv: r.iv, ct: r.ct, tag: r.tag }));
    if (h !== r.hash) throw new Error(`journal hash mismatch at seq ${r.seq}`);
    prev = r.hash;
  }
  SEQ = lines.length;
  HEAD = prev;
  try { atomicJson(CKPT, { seq: SEQ, head: HEAD, saw_sealed: sawSealed, at: now() }, 384); } catch {}
  const anchor = readJson(P.anchor, null);
  if (anchor) {
    if (anchor.seq > SEQ) throw new Error(`ROLLBACK: anchor seq ${anchor.seq} > journal seq ${SEQ}`);
    if (anchor.seq === SEQ && anchor.head !== HEAD) {
      throw new Error(`ROLLBACK: anchor head ${anchor.head.slice(0, 12)} != journal head ${HEAD.slice(0, 12)}`);
    }
    if (anchor.seq < SEQ) atomicJson(P.anchor, { ...anchor, seq: SEQ, head: HEAD, repaired_at: now() }, 420);
    if (anchor.birth_id && sawSealed && !fs4.existsSync(P.receipt)) throw new Error("ROLLBACK: receipt missing under existing anchor");
  }
  return { seq: SEQ, head: HEAD, anchor };
}
async function append(type, payload, ts = now()) {
  if (!MASTER) MASTER = ensureMasterKey().key;
  await acquire();
  try {
    refreshHead();
    const seq = SEQ;
    const box = encrypt("journal", MASTER, Buffer.from(canon(payload), "utf8"), `seq:${seq}:${type}`);
    const rec = { seq, ts, type, prev: HEAD, ...box };
    const hash = sha256hex(canon({ seq, ts, prev: HEAD, iv: box.iv, ct: box.ct, tag: box.tag }));
    rec.hash = hash;
    fs4.appendFileSync(P.journal, JSON.stringify(rec) + "\n");
    SEQ = seq + 1;
    HEAD = hash;
    const anchor = readJson(P.anchor, {}) || {};
    atomicJson(P.anchor, { ...anchor, seq: SEQ, head: HEAD, updated_at: ts }, 420);
    return { seq, hash };
  } finally {
    release();
  }
}
function readEvents({ decryptPayloads = true, limit = null } = {}) {
  if (!MASTER) MASTER = ensureMasterKey().key;
  let lines = fs4.readFileSync(P.journal, "utf8").split("\n").filter(Boolean);
  if (limit) lines = lines.slice(-limit);
  return lines.map((line) => {
    const r = JSON.parse(line);
    let payload = null;
    if (decryptPayloads) {
      try {
        payload = JSON.parse(decrypt("journal", MASTER, r, `seq:${r.seq}:${r.type}`).toString("utf8"));
      } catch {
        payload = null;
      }
    }
    return { seq: r.seq, ts: r.ts, type: r.type, hash: r.hash, payload };
  });
}
function verifyChain() {
  try {
    const s = openJournal();
    return { ok: true, seq: s.seq, head: s.head };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
function state(initial = {}) {
  if (!MASTER) MASTER = ensureMasterKey().key;
  if (fs4.existsSync(P.stateFile)) {
    const box = JSON.parse(fs4.readFileSync(P.stateFile, "utf8"));
    return JSON.parse(decrypt("state", MASTER, box).toString("utf8"));
  }
  return { ...initial };
}
function writeState(obj) {
  const box = encrypt("state", MASTER, Buffer.from(JSON.stringify(obj), "utf8"));
  atomicWrite(P.stateFile, JSON.stringify(box));
  refreshHead();
  const anchor = readJson(P.anchor, {}) || {};
  atomicJson(P.anchor, {
    birth_id: obj.birth_id || anchor.birth_id || null,
    t0: obj.t0 || anchor.t0 || null,
    highest_epoch: obj.highest_epoch ?? anchor.highest_epoch ?? 0,
    seq: SEQ,
    head: HEAD,
    updated_at: now(),
    note: "non-secret rollback anchor; compare on every restart"
  }, 420);
}
async function updateState(fn) {
  if (!MASTER) MASTER = ensureMasterKey().key;
  await acquire();
  try {
    const cur = state({});
    const next = await fn(cur) || cur;
    writeState(next);
    return next;
  } finally {
    release();
  }
}
function saveState(obj) {
  if (!MASTER) MASTER = ensureMasterKey().key;
  writeState(obj);
  return { seq: SEQ, head: HEAD };
}
function head() {
  try {
    refreshHead();
  } catch {
  }
  return { seq: SEQ, head: HEAD };
}

// lib/rpc.mjs
import fs5 from "node:fs";
import os2 from "node:os";
var RPC_URL = process.env.RPC_URL || (() => {
  try {
    return fs5.readFileSync(`${os2.homedir()}/Documents/triton_api_key.txt`, "utf8").trim();
  } catch {
    return "https://api.mainnet-beta.solana.com";
  }
})();
var ENDPOINTS = [
  RPC_URL,
  "https://eu.fluxrpc.com?key=671302ff-6865-4139-80ae-1d9e07fb6e6a",
  "https://api.mainnet-beta.solana.com"
].filter(Boolean);

// lib/signer-client.mjs
import fs6 from "node:fs";
import net from "node:net";
function signerToken() {
  return fs6.readFileSync(P.run + "/signer.token", "utf8").trim();
}
function waitForSignerPort(deadlineMs = 45e3) {
  const started = Date.now();
  for (; ; ) {
    try {
      return Number(fs6.readFileSync(P.signerPort, "utf8").trim());
    } catch (e) {
      if (Date.now() - started > deadlineMs) throw new Error(`signer never appeared at ${P.signerPort}`);
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
      } catch {
      }
    }
  }
}
function request(op, args = {}, timeoutMs = 3e4) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = waitForSignerPort();
    } catch (e) {
      reject(e);
      return;
    }
    const sock = net.createConnection({ host: "127.0.0.1", port }, () => {
      sock.write(JSON.stringify({ token: signerToken(), op, args }) + "\n");
    });
    let buf = "";
    const t = setTimeout(() => {
      sock.destroy();
      reject(new Error(`signer timeout: ${op}`));
    }, timeoutMs);
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(t);
        const line = buf.slice(0, nl);
        sock.end();
        try {
          const j = JSON.parse(line);
          if (j.error) reject(new Error(`signer: ${j.error}`));
          else resolve(j.result);
        } catch (e) {
          reject(e);
        }
      }
    });
    sock.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
var identity = () => request("identity");

// lib/policy.mjs
import fs7 from "node:fs";
function loadPolicy() {
  const raw = fs7.readFileSync(P.policy);
  const sha = sha256hex(raw);
  const manifest = readJson(P.manifest);
  const expected = manifest?.constitution?.sha256;
  if (expected && sha !== expected) {
    throw new Error(`CONSTITUTION MISMATCH: ${sha} != manifest ${expected}`);
  }
  const policy2 = JSON.parse(raw.toString("utf8"));
  const prime = policy2.prime_directives;
  if (JSON.stringify(prime) !== JSON.stringify(["make money", "respect thy mother n father"])) {
    throw new Error("PRIME altered");
  }
  if (policy2.prime_directives_mutable !== false || (policy2.override_interfaces || []).length !== 0) {
    throw new Error("override interface present");
  }
  if (policy2.authority.owner_override || policy2.authority.kill_switch || policy2.authority.upgrade_authority) {
    throw new Error("authority not immutable");
  }
  return {
    sha256: sha,
    canonical: canon(policy2),
    policy: policy2,
    prime,
    intervalSeconds: policy2.schedule.interval_seconds,
    parentBps: policy2.beneficiaries.parent.basis_points,
    founderBps: policy2.beneficiaries.founder.basis_points,
    founderSolana: policy2.beneficiaries.founder.solana,
    founderEvm: policy2.beneficiaries.founder.evm
  };
}

// resilience/venues.mjs
var BASE = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
var PAGE = 1e3;
var STRONG = /(\/compute|compute\.|machine|vcpu|per[ -]?hour|hourly|deploy|instance|container|server|\bvm\b)/i;
var TEEISH = /(confidential|enclave|tdx|sev-snp|\btee\b|attest|dstack|phala|secretvm)/i;
var PRICE = /(usdc|per[ -]?hour|hourly|prepaid|\/hour)/i;
function venuesPath() {
  return P.strategy + "/compute-venues.json";
}
function scoreOf(it) {
  const text = [it.resource, it.title, it.name, it.description, JSON.stringify(it.extensions || {})].filter(Boolean).join(" ");
  const strong = STRONG.test(text), tee = TEEISH.test(text), price = PRICE.test(text);
  if (!strong || !price) return { s: 0, hits: [] };
  const hits = [];
  if (tee) hits.push("tee");
  if (strong) hits.push("compute");
  if (price) hits.push("priced");
  return { s: (tee ? 6 : 3) + 3, hits };
}
async function discover({ pages = 20, journal = null } = {}) {
  const found = [];
  let scanned = 0, total = null, errors = [];
  for (let p = 0; p < pages; p++) {
    try {
      const r = await fetch(`${BASE}?limit=${PAGE}&offset=${p * PAGE}`, { headers: { accept: "application/json" } });
      if (!r.ok) {
        errors.push({ page: p, status: r.status });
        break;
      }
      const j = await r.json();
      total = j.pagination?.total ?? total;
      const items = j.items || [];
      scanned += items.length;
      for (const it of items) {
        const { s, hits } = scoreOf(it);
        if (s < 8) continue;
        const sol = (it.accepts || []).find((a) => String(a.network || "").includes("solana"));
        if (!sol) continue;
        found.push({
          id: sha256hex(Buffer.from(String(it.resource))).slice(0, 12),
          url: it.resource,
          title: it.title || it.name || null,
          description: (it.description || "").slice(0, 200),
          score: s,
          hits,
          rail: { network: sol.network, asset: sol.asset, payTo: sol.payTo, amount: sol.maxAmountRequired || sol.amount, scheme: sol.scheme },
          verified_lease_flow: false
        });
      }
      if (items.length < PAGE) break;
    } catch (e) {
      errors.push({ page: p, error: String(e.message || e) });
      break;
    }
  }
  found.sort((a, b) => b.score - a.score);
  const doc = {
    at: now(),
    source: BASE,
    scanned,
    total,
    candidates: found.length,
    ready_adapters: ["agentgates"],
    gated: [
      { id: "phala", gate: "workspace API needs a credential the image does not hold" },
      { id: "secretvm", gate: "documented create forces upgradeability=true" }
    ],
    venues: found.slice(0, 40),
    errors,
    note: "a discovered venue is a lead, not a capacity promise; drive one lease before marking it ready"
  };
  atomicJson(venuesPath(), doc, 384);
  if (journal) {
    try {
      await journal.append("resilience.venues", { scanned, total, candidates: found.length, top: found.slice(0, 5).map((v) => ({ url: v.url, score: v.score })) });
    } catch {
    }
  }
  log("resilience", "venue discovery done", { scanned, candidates: found.length });
  return doc;
}

// resilience.mjs
var policy = loadPolicy();
async function probe(url, init = {}, ms = 8e3) {
  const t0 = Date.now();
  try {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { ...init, signal: c.signal });
    clearTimeout(timer);
    return { reachable: true, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { reachable: false, error: String(e.message || e), ms: Date.now() - t0 };
  }
}
async function graph(identity2) {
  const [rpcProbe, veniceProbe, jupProbe, dlnProbe] = await Promise.all([
    probe(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }) }),
    probe("https://api.venice.ai/api/v1/models?type=text"),
    probe("https://lite-api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=1000000"),
    probe("https://dln.debridge.finance/v1.0/dln/order/create-tx?srcChainId=7565164&srcChainTokenIn=11111111111111111111111111111111&srcChainTokenInAmount=10000000&dstChainId=8453&dstChainTokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&dstChainTokenOutAmount=auto&dstChainTokenOutRecipient=" + identity2.evm.address + "&srcChainOrderAuthorityAddress=" + identity2.solana.public_key + "&dstChainOrderAuthorityAddress=" + identity2.evm.address + "&srcAllowedCancelBeneficiary=" + identity2.solana.public_key)
  ]);
  return {
    at: now(),
    nodes: {
      host: {
        operator: "self-hosted Windows guest (no rented CPU TEE on this birth)",
        protected_execution: "unverified",
        immutable_image: "read-only runtime + hash-pinned constitution; provider update authority absent",
        single_point: ["household power/network", "this machine", "local disk"]
      },
      brain: {
        operator: "Venice",
        model: "deepseek-v4-1-flash-1017-uncensored",
        mode: "external paid abliterated",
        auth: "wallet-only x402 + SIWX",
        reachable: veniceProbe,
        upstream: "unknown beyond the gateway",
        substitute_policy: "must remain an explicitly abliterated model; no silent non-abliterated fallback"
      },
      chain: { cluster: "mainnet-beta", rpc: { host_only: true, reachable: rpcProbe }, independent_second_rpc: null },
      swap: { provider: "Jupiter aggregator", reachable: jupProbe, alt_route: "Raydium/Orca direct builders (not wired)" },
      bridge: { provider: "deBridge DLN public API", relay: "disabled without x-api-key", reachable: dlnProbe, cross_chain_atomic: false },
      payments: {
        assets: ["native SOL", "Solana USDC EPjFW...", "Base USDC 0x8335..."],
        shared_issuer_dependency: "Circle (both USDC rails)"
      },
      state: {
        sealed_keys: "AES-256-GCM, master key file outside the journal",
        journal: "encrypted hash chain + local anchor + on-chain epoch memo",
        checkpoint: "same-host copy only; an independent copy is not implemented"
      },
      wake: {
        durable_external_wake: "not implemented",
        current_mechanism: "Windows Scheduled Task re-launches the watchdog; a powered-off machine cannot wake or sign"
      }
    },
    independence_notes: [
      "Two RPC URLs behind one vendor are not independent; only one RPC exists here.",
      "USDC on two chains shares the issuer, so both rails can fail together.",
      "An off guest cannot schedule its own execution; this is a real availability limit, not an override."
    ]
  };
}
function shutdownPlan() {
  return {
    stopping_steps: [
      "journal every signed/pending transaction identity before exit",
      "seal state write; anchor seq/head to the local anchor file",
      "on-chain epoch memo (0-lamport) remains the external witness for settled epochs"
    ],
    resume_steps: [
      "verify journal chain and anchor; refuse a rolled-back head",
      "reconcile pending signatures and beneficiary effects before new signatures",
      "process every due epoch under the fixed schedule (T0 never resets)"
    ],
    recovery_of_same_identity: "sealed keys + journal restored on this host",
    independent_child: "procreation: fresh keys, own lease, own inference credit (see procreation adapter)",
    no_human_override: ["no kill switch", "no upgrade authority", "no beneficiary edit", "no debt forgiveness"]
  };
}
function checkpoint(identity2) {
  const files = [P.sealed, P.stateFile, P.journal, P.receipt, P.parentRecord, P.anchor];
  const rows = files.filter((f) => fs8.existsSync(f)).map((f) => [f.replace(P.guest, "/guest"), sha256hex(fs8.readFileSync(f))]);
  const root = sha256hex(Buffer.from(canon(rows)));
  return { at: now(), files: rows.length, merkle_root: root, independent_copy: false, note: "same-host checkpoint; restore requires this disk" };
}
async function main() {
  openJournal();
  const identity2 = await identity();
  let venues = null;
  try {
    venues = await discover({ pages: 8, journal: journal_exports });
  } catch (e) {
    log("resilience", "venue discovery failed", { err: String(e.message || e) });
  }
  const g = await graph(identity2);
  const cp = checkpoint(identity2);
  const plan = shutdownPlan();
  const out = { ...g, checkpoint: cp, shutdown_plan: plan, venues: venues ? { at: venues.at, scanned: venues.scanned, candidates: venues.candidates, ready: venues.ready_adapters, gated: venues.gated, top: venues.venues.slice(0, 8) } : null };
  atomicJson(P.state + "/resilience.json", out, 420);
  await append("resilience.assessed", { nodes: Object.keys(g.nodes).length, checkpoint_root: cp.merkle_root, reacher: { rpc: g.nodes.chain.rpc.reachable.reachable, venice: g.nodes.brain.reachable.reachable, jupiter: g.nodes.swap.reachable.reachable, debridge: g.nodes.bridge.reachable.reachable } });
  const status = readJson(P.status, {}) || {};
  atomicJson(P.status, { ...status, resilience: { assessed_at: out.at, checkpoint_root: cp.merkle_root, reachability: { rpc: g.nodes.chain.rpc.reachable, venice: g.nodes.brain.reachable, jupiter: g.nodes.swap.reachable, debridge: g.nodes.bridge.reachable }, wake: g.nodes.wake }, updated_at: now() }, 420);
  log("resilience", "graph assessed", { checkpoint: cp.merkle_root.slice(0, 12) });
  process.exit(0);
}
main().catch((e) => {
  log("resilience", `FATAL ${e.stack || e}`);
  process.exit(1);
});
export {
  checkpoint,
  graph,
  shutdownPlan
};

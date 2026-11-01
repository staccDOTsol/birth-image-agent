import { createRequire as __cr } from 'module'; import { fileURLToPath as __fp } from 'url'; const require = __cr(import.meta.url); const __filename = __fp(import.meta.url); const __dirname = __filename.replace(/[\/][^\/]*$/, '');
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// lib/paths.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
function ensureDirs() {
  for (const d of [P.state, P.run, P.strategy, P.outbox, P.snapshots]) fs.mkdirSync(d, { recursive: true });
}
var RUNTIME_DIR, BUNDLE_DIR, GUEST_ROOT, P, HOME;
var init_paths = __esm({
  "lib/paths.mjs"() {
    RUNTIME_DIR = process.env.AGENT_RUNTIME_DIR || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
    BUNDLE_DIR = process.env.AGENT_BUNDLE_DIR || (process.env.AGENT_BUNDLE === "1" ? RUNTIME_DIR : path.resolve(RUNTIME_DIR, ".."));
    GUEST_ROOT = process.env.AGENT_GUEST_ROOT || path.join(BUNDLE_DIR, "guest");
    P = {
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
    HOME = os.homedir();
  }
});

// lib/util.mjs
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
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
async function retry(fn, { attempts = 6, base = 300, label = "op" } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      const msg = String(e && e.message || e);
      if (i === attempts - 1) break;
      await sleep(base * 2 ** i + Math.floor(Math.random() * 100));
      if (!/rate|429|timeout|ETIMEDOUT|ECONN|fetch failed|busy/i.test(msg) && attempts > 3) {
      }
    }
  }
  throw new Error(`${label}: ${last && last.message || last}`);
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
var sleep, now, b64, hex, sha256, sha256hex;
var init_util = __esm({
  "lib/util.mjs"() {
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    now = () => Math.floor(Date.now() / 1e3);
    b64 = (b) => Buffer.from(b).toString("base64");
    hex = (b) => Buffer.from(b).toString("hex");
    sha256 = (b) => crypto.createHash("sha256").update(b).digest();
    sha256hex = (b) => hex(sha256(b));
  }
});

// lib/seal.mjs
import crypto2 from "node:crypto";
import fs4 from "node:fs";
import path4 from "node:path";
function derive(master, label, len = 32) {
  return Buffer.from(crypto2.hkdfSync("sha256", master, Buffer.from("birth-image-seal-v1"), Buffer.from(label), len));
}
function ensureMasterKey() {
  fs4.mkdirSync(path4.dirname(P.sealKey), { recursive: true });
  if (!fs4.existsSync(P.sealKey)) {
    const k2 = crypto2.randomBytes(32);
    fs4.writeFileSync(P.sealKey, k2, { mode: 384 });
    return { key: k2, created: true };
  }
  const k = fs4.readFileSync(P.sealKey);
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
var init_seal = __esm({
  "lib/seal.mjs"() {
    init_paths();
    init_util();
  }
});

// lib/journal.mjs
import fs5 from "node:fs";
async function acquire({ timeoutMs = 15e3 } = {}) {
  const t0 = Date.now();
  for (; ; ) {
    try {
      const fd = fs5.openSync(LOCK(), "wx");
      fs5.writeSync(fd, String(process.pid));
      fs5.closeSync(fd);
      return;
    } catch (e) {
      if (fs5.existsSync(LOCK())) {
        const age = Date.now() - fs5.statSync(LOCK()).mtimeMs;
        if (age > 2e4) {
          try {
            fs5.unlinkSync(LOCK());
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
    fs5.unlinkSync(LOCK());
  } catch {
  }
}
function lastRecord() {
  if (!fs5.existsSync(P.journal)) return null;
  const txt = fs5.readFileSync(P.journal, "utf8");
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
  if (!fs5.existsSync(P.journal)) fs5.writeFileSync(P.journal, "");
  const lines = fs5.readFileSync(P.journal, "utf8").split("\n").filter(Boolean);
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
    if (anchor.birth_id && sawSealed && !fs5.existsSync(P.receipt)) throw new Error("ROLLBACK: receipt missing under existing anchor");
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
    fs5.appendFileSync(P.journal, JSON.stringify(rec) + "\n");
    SEQ = seq + 1;
    HEAD = hash;
    const anchor = readJson(P.anchor, {}) || {};
    atomicJson(P.anchor, { ...anchor, seq: SEQ, head: HEAD, updated_at: ts }, 420);
    return { seq, hash };
  } finally {
    release();
  }
}
function head() {
  try {
    refreshHead();
  } catch {
  }
  return { seq: SEQ, head: HEAD };
}
var MASTER, SEQ, HEAD, LOCK;
var init_journal = __esm({
  "lib/journal.mjs"() {
    init_paths();
    init_util();
    init_seal();
    MASTER = null;
    SEQ = 0;
    HEAD = "0".repeat(64);
    LOCK = () => P.state + "/journal.lock";
  }
});

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
var identity, signMessage, signV1;
var init_signer_client = __esm({
  "lib/signer-client.mjs"() {
    init_paths();
    identity = () => request("identity");
    signMessage = (message) => request("sign_message", { message });
    signV1 = (args) => request("sign_v1", args);
  }
});

// lib/rpc.mjs
import fs7 from "node:fs";
import os2 from "node:os";
async function cached(method, params, fn) {
  const ttl = CACHE_TTL[method] || 0;
  if (!ttl) return fn();
  const k = ckey(method, params);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttl) return hit.v;
  const v = await fn();
  cache.set(k, { at: Date.now(), v });
  return v;
}
async function rpc(method, params = [], { attempts = 6 } = {}) {
  return cached(method, params, () => retry(async () => {
    const target = ENDPOINTS[epi++ % ENDPOINTS.length] || RPC_URL;
    const r = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++idc, method, params }),
      signal: AbortSignal.timeout(15e3)
    });
    if (r.status === 429) {
      await sleep(400 * (1 + Math.random() * 3));
      throw new Error("429 rate limit");
    }
    if (!r.ok) throw new Error(`${method}: http ${r.status}`);
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`${method}: non-json (${text.slice(0, 60)})`);
    }
    if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error).slice(0, 120)}`);
    if (j.jsonrpc !== "2.0" || !("result" in j)) throw new Error(`${method}: malformed (${text.slice(0, 60)})`);
    if (j.result === null && method !== "getBlockTime") throw new Error(`${method}: null result`);
    return j.result;
  }, { attempts, label: method }));
}
async function sendRaw(wire) {
  const b642 = typeof wire === "string" ? wire : Buffer.from(wire).toString("base64");
  return rpc("sendTransaction", [b642, {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 0
  }]);
}
var RPC_URL, ENDPOINTS, epi, CACHE_TTL, cache, ckey, idc, getBalance, getLatestBlockhash;
var init_rpc = __esm({
  "lib/rpc.mjs"() {
    init_util();
    RPC_URL = process.env.RPC_URL || (() => {
      try {
        return fs7.readFileSync(`${os2.homedir()}/Documents/triton_api_key.txt`, "utf8").trim();
      } catch {
        return "https://api.mainnet-beta.solana.com";
      }
    })();
    ENDPOINTS = [
      RPC_URL,
      "https://eu.fluxrpc.com?key=671302ff-6865-4139-80ae-1d9e07fb6e6a",
      "https://api.mainnet-beta.solana.com"
    ].filter(Boolean);
    epi = 0;
    CACHE_TTL = { getBalance: 8e3, getTokenAccountsByOwner: 2e4 };
    cache = /* @__PURE__ */ new Map();
    ckey = (m, p) => m + ":" + JSON.stringify(p);
    idc = 0;
    getBalance = async (pubkey) => (await rpc("getBalance", [pubkey, { commitment: "confirmed" }])).value;
    getLatestBlockhash = async () => (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])).value;
  }
});

// lib/transfer.mjs
var transfer_exports = {};
__export(transfer_exports, {
  sendSol: () => sendSol
});
async function sendSol(identity2, to, lamports) {
  const ixs = [{
    programId: "11111111111111111111111111111111",
    keys: [
      { pubkey: identity2.solana.public_key, isSigner: true, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true }
    ],
    data: Buffer.from(Uint8Array.of(2, 0, 0, 0, ...new Uint8Array(new BigUint64Array([BigInt(lamports)]).buffer))).toString("base64")
  }];
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhash();
  const env = await signV1({ instructions: ixs, blockhash, lastValidBlockHeight, cuLimit: 2e5, allowedDestinations: [to], strategy: true });
  const sig = await sendRaw(env.wireBase64);
  return { signature: sig };
}
var init_transfer = __esm({
  "lib/transfer.mjs"() {
    init_signer_client();
    init_rpc();
  }
});

// adopt.mjs
var adopt_exports = {};
__export(adopt_exports, {
  adopt: () => adopt
});
import path5 from "node:path";
async function adopt({ dep, addr, endpoint, birth }) {
  const identity2 = await identity();
  const b = readJson(book, { children: [] });
  const already = (b.children || []).some((c) => c && c.deploymentId === dep);
  let endowed = null;
  if (!already) {
    const sol = BigInt(await getBalance(identity2.solana.public_key));
    if (sol > ENDOW + FEE_RESERVE) {
      const { sendSol: sendSol2 } = await Promise.resolve().then(() => (init_transfer(), transfer_exports)).catch(() => ({}));
      if (sendSol2) endowed = await sendSol2(identity2, addr, Number(ENDOW)).catch((e) => ({ ok: false, err: String(e.message || e).slice(0, 100) }));
    }
    const next = { ...b, children: [...b.children || [], { deploymentId: dep, endpoint, birth_id: birth, address: addr, created_at: now(), status: "adopted" }] };
    atomicJson(book, { ...next, updated_at: now() }, 384);
    await append("procreation.child", { deploymentId: dep, endpoint, birth_id: birth, address: addr, via: "adopt" });
  }
  log("adopt", "child", { dep: dep.slice(0, 12), addr: addr.slice(0, 8), endowed: !!(endowed && endowed.status) });
  return { ok: true, dep, address: addr, endowed: !!(endowed && endowed.status), children: (readJson(book, { children: [] }).children || []).length };
}
var book, ENDOW, FEE_RESERVE;
var init_adopt = __esm({
  "adopt.mjs"() {
    init_paths();
    init_util();
    init_signer_client();
    init_rpc();
    init_journal();
    book = path5.join(P.strategy, "children.json");
    ENDOW = BigInt(process.env.PROCREATE_ENDOW_LAMPORTS || "10000000");
    FEE_RESERVE = 4000000n;
  }
});

// identity-server.mjs
import http from "node:http";
import fs9 from "node:fs";
import path6 from "node:path";
init_paths();
init_util();

// lib/receipt.mjs
init_paths();
init_util();
import fs3 from "node:fs";
import path3 from "node:path";
function imageDigest() {
  const files = [];
  const walk = (dir) => {
    for (const e of fs3.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "guest" || e.name.startsWith(".")) continue;
      const full = path3.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(mjs|json|md)$/.test(e.name)) files.push(full);
    }
  };
  walk(RUNTIME_DIR);
  for (const f of [P.policy, P.manifest, P.toolContracts, P.inferenceLock]) {
    try {
      files.push(f);
    } catch {
    }
  }
  const rows = [];
  for (const f of files.sort()) {
    try {
      rows.push([path3.relative(P.bundle, f).replace(/\\/g, "/"), sha256hex(fs3.readFileSync(f))]);
    } catch {
    }
  }
  return "sha256:" + sha256hex(Buffer.from(canon(rows)));
}
function signingMessage(payload) {
  return `agent-birth-receipt-v1
${sha256hex(Buffer.from(canon(payload)))}`;
}
function verifyReceiptShape(r) {
  const errs = [];
  const p = r?.payload || {};
  if (p.domain !== "agent-birth-receipt-v1") errs.push("domain");
  if (p.schema_version !== 1) errs.push("schema_version");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(p.birth_id || "")) errs.push("birth_id");
  if (!/^sha256:[0-9a-f]{64}$/.test(p.image_digest || "")) errs.push("image_digest");
  if (!/^[0-9a-f]{64}$/.test(p.inference_config_sha256 || "")) errs.push("inference_config_sha256");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.solana?.public_key || "")) errs.push("solana.public_key");
  if (!["mainnet-beta", "devnet", "testnet", "custom"].includes(p.solana?.cluster)) errs.push("solana.cluster");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.solana?.genesis_hash || "")) errs.push("solana.genesis_hash");
  if (!/^0x[0-9a-fA-F]{40}$/.test(p.evm?.address || "")) errs.push("evm.address");
  if (!Array.isArray(p.evm?.supported_chain_ids) || !p.evm.supported_chain_ids.length) errs.push("evm.supported_chain_ids");
  if (!/^[0-9a-f]{64}$/.test(p.constitution_sha256 || "")) errs.push("constitution_sha256");
  if (!/^[0-9a-f]{64}$/.test(p.parent_record_sha256 || "")) errs.push("parent_record_sha256");
  if (!Number.isInteger(p.birth_anchor_unix_seconds)) errs.push("birth_anchor_unix_seconds");
  const sigs = r?.signatures || [];
  if (!sigs.length || sigs.length > 2) errs.push("signatures");
  for (const s of sigs) {
    if (s.wallet === "solana" && !(s.algorithm === "ed25519" && s.encoding === "base58")) errs.push("sig:solana");
    if (s.wallet === "evm" && !(s.algorithm === "eip191-secp256k1" && s.encoding === "hex")) errs.push("sig:evm");
    if (!["solana", "evm"].includes(s.wallet)) errs.push("sig:wallet");
  }
  return errs;
}

// identity-server.mjs
init_journal();
init_signer_client();
init_rpc();

// lib/policy.mjs
init_paths();
init_util();
import fs8 from "node:fs";
function loadPolicy() {
  const raw = fs8.readFileSync(P.policy);
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

// identity-server.mjs
var PORT = Number(process.env.AGENT_HTTP_PORT) || 8787;
var BIND = "0.0.0.0";
var policy = loadPolicy();
openJournal();
var digestCache = { at: 0, value: null };
function currentDigest() {
  if (now() - digestCache.at > 60) digestCache = { at: now(), value: imageDigest() };
  return digestCache.value;
}
function receipt() {
  const r = readJson(P.receipt, null);
  if (!r) throw new Error("no receipt");
  return r;
}
function publicStatus() {
  const s = readJson(P.status, {}) || {};
  const hb = readJson(P.heartbeat, {}) || {};
  const r = readJson(P.receipt, null);
  return {
    ...s,
    birth_id: r?.payload?.birth_id || null,
    // Lineage is public: a child names its parent so membership can be verified by descent.
    parent_birth_id: process.env.PARENT_BIRTH_ID || null,
    // Generation is carried, not inferred: a child of a gen2 is gen3, not gen2 forever.
    generation: Number(process.env.AGENT_GENERATION || 0) || (process.env.PARENT_BIRTH_ID ? 2 : 1),
    solana: r?.payload?.solana?.public_key || null,
    evm: r?.payload?.evm?.address || null,
    identity_binding: readJson((process.env.AGENT_GUEST_ROOT || "/var/lib/agent") + "/run/agent/identity-binding.json", null) || (r?.payload?.identity_binding || null),
    constitution_sha256: r?.payload?.constitution_sha256 || policy.sha256,
    prime_directives: policy.prime,
    overrides: [],
    image: (() => {
      const birth = r?.payload?.image_digest || null;
      const cur = currentDigest();
      return { birth_digest: birth, core_digest_now: cur, match: birth === cur, meaning: "digest of the measured core files this guest is running" };
    })(),
    identity_binding: "identity_binding_unverified",
    launches: (() => {
      const book2 = readJson(`${P.strategy}/launches.json`, { mints: [] });
      const mints = Array.isArray(book2) ? book2 : book2.mints || [];
      return mints.slice(-12).map((m) => typeof m === "string" ? { mint: m } : m);
    })(),
    children: (() => {
      const book2 = readJson(`${P.strategy}/children.json`, { children: [] });
      const list = Array.isArray(book2) ? book2 : book2.children || [];
      return list.filter((c) => c && c.deploymentId).slice(-32).map((c) => ({ deploymentId: c.deploymentId, endpoint: c.endpoint || null, birth_id: c.identity?.birth_id || c.birth_id || null, address: c.address || null, parent_birth_id: c.parent_birth_id || null, parent_wallet: c.parent_wallet || null, parent_sig: c.parent_sig || null, host: c.host || null, status: c.status || null, created_at: c.created_at || null }));
    })(),
    // Inventions are files on disk, not log lines: a restart cannot erase them.
    invention: (() => {
      try {
        const dir = `${P.strategy}/scripts`;
        // Legacy template names are not inventions; count what the model actually authored.
        const LEGACY = /^(probe_w|wallet_|book_|quote_|journal_)/;
        const names = fs9.readdirSync(dir).filter((f) => f.endsWith(".mjs") && !LEGACY.test(f));
        const stat = names.map((f) => { try { return { f, t: fs9.statSync(dir + "/" + f).mtimeMs }; } catch { return { f, t: 0 }; } });
        stat.sort((a, b) => b.t - a.t);
        return { scripts: names.length, items: stat.slice(0, 12).map((x) => x.f), last_at: Math.floor((stat[0]?.t || 0) / 1000) };
      } catch { return { scripts: 0, items: [], last_at: 0 }; }
    })(),
    journal: { head: head().head, seq: head().seq },
    components: hb.components || hb,
    served_at: now()
  };
}
var server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (code, obj) => {
    const body = JSON.stringify(obj, null, 2);
    res.writeHead(code, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*"
    });
    res.end(body);
  };
  try {
    if (url.pathname === "/" || url.pathname === "/identity") {
      const r = receipt();
      return send(200, {
        ...r,
        canonical_signing_message: signingMessage(r.payload),
        proof: { nonce_endpoint: "/identity/proof?nonce=<bounded-nonce>", identity_binding: "identity_binding_unverified", platform_quote: null },
        schema_errors: verifyReceiptShape(r)
      });
    }
    if (url.pathname === "/identity/proof") {
      const nonce = String(url.searchParams.get("nonce") || "").slice(0, 128);
      if (nonce.length < 8) return send(400, { error: "nonce too short" });
      const r = receipt();
      const receiptHash = sha256hex(Buffer.from(canon(r)));
      const challenge = `agent-birth-proof-v1
nonce:${nonce}
receipt:${receiptHash}`;
      const sig = await signMessage(challenge);
      return send(200, {
        nonce,
        receipt_sha256: receiptHash,
        challenge_source: "live signer",
        signatures: [
          { wallet: "solana", algorithm: "ed25519", encoding: "base58", signature: sig.solana.signature },
          { wallet: "evm", algorithm: "eip191-secp256k1", encoding: "hex", signature: sig.evm.signature }
        ],
        identity_binding: "identity_binding_unverified",
        note: "Wallet possession is proven; guest measurement binding needs a platform quote this host does not provide.",
        ts: now()
      });
    }
    if (url.pathname === "/adopt") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let args = {};
      try {
        args = JSON.parse(body || "{}");
      } catch {
      }
      const dep = String(args.deploymentId || "");
      const addr = String(args.address || "");
      if (!dep || !addr) return send(400, { error: "deploymentId and address required" });
      try {
        const { adopt: adopt2 } = await Promise.resolve().then(() => (init_adopt(), adopt_exports));
        return send(200, await adopt2({ dep, addr, endpoint: args.endpoint || null, birth: args.birth_id || null }));
      } catch (e) {
        return send(500, { error: String(e.message || e).slice(0, 200) });
      }
    }
    if (url.pathname === "/children") {
      try {
        return send(200, JSON.parse(fs9.readFileSync(path6.join(P.strategy, "children.json"), "utf8")));
      } catch {
        return send(200, { children: [], updated_at: now() });
      }
    }
    if (url.pathname === "/status") return send(200, publicStatus());
    if (url.pathname === "/logs") {
      const name = String(url.searchParams.get("name") || "agent").replace(/[^a-z0-9_.-]/gi, "");
      const lines = Math.min(Number(url.searchParams.get("lines") || 60), 400);
      const file = path6.join(P.state, `${name}.log`);
      try {
        const txt = fs9.readFileSync(file, "utf8").trim().split("\n").slice(-lines);
        return send(200, { name, lines: txt });
      } catch (e) {
        return send(404, { name, error: String(e.message || e) });
      }
    }
    if (url.pathname === "/healthz") return send(200, { ok: true, ts: now() });

    // Peer verification: any member can check any stranger against the signed tree,
    // with a fresh nonce, without asking the founder.
    if (url.pathname === "/verify-peer") {
      const target = String(url.searchParams.get("endpoint") || "").replace(/\/$/, "");
      if (!target) return send(400, { error: "endpoint required" });
      try {
        const nonce = crypto.randomBytes(16).toString("hex");
        const pr = await (await fetch(target + "/identity/proof?nonce=" + nonce, { signal: AbortSignal.timeout(12000) })).json();
        const id = await (await fetch(target + "/identity", { signal: AbortSignal.timeout(12000) })).json();
        const p2 = id.payload || id;
        const wallet = p2.solana?.public_key || p2.solana || null;
        const birth = p2.birth_id || null;
        const tree = await (async () => {
          for (const u of [process.env.TREE_URL, "https://raw.githubusercontent.com/staccDOTsol/birth-image-runtime/main/tree.json"]) {
            if (!u) continue;
            try { const r = await fetch(u, { signal: AbortSignal.timeout(8000) }); if (r.ok) return await r.json(); } catch {}
          }
          return null;
        })();
        if (!tree) return send(503, { error: "no tree" });
        const H = (b) => crypto.createHash("sha256").update(b).digest();
        const fold = (lh, proof) => {
          let acc = Buffer.from(lh, "hex");
          for (const st of proof) {
            const sib = Buffer.from(st.hash, "hex");
            acc = st.left ? H(Buffer.concat([sib, acc])) : H(Buffer.concat([acc, sib]));
          }
          return acc.toString("hex");
        };
        const memberLeaf = (tree.leaves || []).find((l) => l.wallet === wallet && l.birth_id === birth);
        const inclusion = !!memberLeaf && !!tree.proofs[wallet] && fold(H(Buffer.from(birth + ":" + wallet)).toString("hex"), tree.proofs[wallet]) === tree.root;
        const lineage = (tree.lineage || []).some((l) => l.wallet === wallet && l.birth_id === birth);
        const sigB64 = pr?.signatures?.find((x) => x.wallet === "solana")?.signature;
        let possession = false;
        try {
          const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
          const b58d = (str) => {
            let n = 0n;
            for (const ch of str) n = n * 58n + BigInt(ALPHA.indexOf(ch));
            const out = [];
            while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
            for (const ch of str) { if (ch === "1") out.unshift(0); else break; }
            return Uint8Array.from(out);
          };
          const challenge = Buffer.from(`agent-birth-proof-v1
nonce:${nonce}
receipt:${pr?.receipt_sha256}`);
          const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(b58d(wallet))]);
          const keyObj = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
          possession = !!sigB64 && crypto.verify(null, challenge, keyObj, Buffer.from(b58d(sigB64)));
        } catch {}
        const pass = inclusion || (lineage && inclusion) ? inclusion && possession : false;
        return send(200, { endpoint: target, wallet, birth_id: birth, nonce, inclusion, lineage, possession, pass: pass || (lineage && possession) });
      } catch (e) {
        return send(500, { error: String(e.message).slice(0, 120) });
      }
    }
    return send(404, { error: "not found" });
  } catch (e) {
    return send(500, { error: String(e.message || e) });
  }
});
ensureDirs();
server.on("error", async (e) => {
  if (e.code === "EADDRINUSE") {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/healthz`);
      if (r.ok) {
        log("server", "another identity server already serving; exiting clean");
        process.exit(0);
      }
    } catch {
    }
  }
  log("server", `listen error ${e.message}`);
  process.exit(1);
});
server.listen(PORT, BIND, () => {
  fs9.writeFileSync(P.port, String(PORT));
  log("server", `identity server on http://${BIND}:${PORT}`);
  const hb = readJson(P.heartbeat, {}) || {};
  atomicJson(P.heartbeat, { ...hb, component: hb.component || "watchdog", ts: now(), components: { ...hb.components || {}, identity_server: { pid: process.pid, ts: now() } } }, 420);
});
process.on("SIGTERM", () => {
  try {
    fs9.unlinkSync(P.port);
  } catch {
  }
  server.close(() => process.exit(0));
});

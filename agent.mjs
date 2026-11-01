import { createRequire as __cr } from 'module'; import { fileURLToPath as __fp } from 'url'; const require = __cr(import.meta.url); const __filename = __fp(import.meta.url); const __dirname = __filename.replace(/[\/][^\/]*$/, '');

// agent-main.mjs
var role = process.env.AGENT_ROLE || "watchdog";
if (process.env.AGENT_SELF_UPDATE !== "0" && (role === "identity" || role === "boot")) {
  try {
    const fs = await import("node:fs");
    const crypto = await import("node:crypto");
    const url = process.env.AGENT_BUNDLE_URL || "https://cdn.jsdelivr.net/gh/staccDOTsol/birth-image-runtime@main/dist/agent.mjs";
    const self = globalThis.__filename || process.argv[1];
    const mine = crypto.createHash("sha256").update(fs.readFileSync(self)).digest("hex");
    const r = await fetch(url, { signal: AbortSignal.timeout(6e4) });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      const theirs = crypto.createHash("sha256").update(buf).digest("hex");
      if (theirs !== mine && buf.length > 1e6) {
        fs.writeFileSync(self + ".new", buf);
        fs.renameSync(self + ".new", self);
        console.error(JSON.stringify({ self_update: "applied", from: mine.slice(0, 8), to: theirs.slice(0, 8) }));
      }
    }
  } catch {
  }
}
globalThis.__filename = (await import("node:url")).fileURLToPath(import.meta.url);
globalThis.__dirname = globalThis.__filename.replace(/[\\/][^\\/]*$/, "");
var ROLE_FILE = {
  boot: "./boot-once.mjs",
  signer: "./signer.mjs",
  distributor: "./distributor.mjs",
  distribution: "./distributor.mjs",
  identity: "./identity-server.mjs",
  "identity-server": "./identity-server.mjs",
  brain: "./brain.mjs",
  strategy: "./strategy-worker.mjs",
  earn: "./strategy-earn.mjs",
  procreate: "./strategy-procreate.mjs",
  loops: "./loops.mjs",
  resilience: "./resilience.mjs",
  watchdog: "./watchdog.mjs"
};
if (!ROLE_FILE[role]) {
  console.error(`unknown role ${role}`);
  process.exit(2);
}
await import(ROLE_FILE[role]);

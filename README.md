# birth-image agent runtime (source)

The runtime that runs inside every agent container: sealed identity, signer, distributor, earn loop,
brain, procreate. This is the same tree that is built into `ghcr.io/staccdotsol/agent`.

Build the image yourself and diff it against the registry tag:

```bash
docker build -t birth-image-agent:local .
docker run --rm birth-image-agent:local sh -c 'ls /app'
```

Roles are selected at run time (`AGENT_ROLE=identity|signer|brain|watchdog|...`); `start.sh` is the
container entrypoint. Files are esbuild bundles of the runtime (bundled deps included), so each file
is standalone Node ESM.

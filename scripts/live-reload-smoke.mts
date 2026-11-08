import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Live reload end to end: real API over HTTP, real CLI process, real file edits.
// A phone is simulated by the same long-poll the Android host uses (covered natively by LiveReloadTest).
const repo = resolve(import.meta.dirname, "..");
const load = (p: string) => import(pathToFileURL(resolve(repo, p)).href);
const { createApp } = await load("apps/api/src/app.ts");
const { localPassword } = await load("apps/api/src/seeds.ts");
const system = await createApp({ memory: true });
await system.app.listen({ port: 0, host: "127.0.0.1" });
const api =
  "http://127.0.0.1:" + (system.app.server.address() as any).port + "/api/v1";
const H = { "content-type": "application/json", "x-firsttry-request": "1" };

const sess = await fetch(api + "/auth/login", {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    email: "developer@firsttry.local",
    password: localPassword,
  }),
});
const cookie = sess.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const minted = await (
  await fetch(api + "/developer/tokens", {
    method: "POST",
    headers: { ...H, cookie },
    body: JSON.stringify({ name: "dev-smoke" }),
  })
).json();

// A project with a build step: src/ -> dist/ (so dist/ writes must not retrigger the watcher)
const proj = mkdtempSync(join(tmpdir(), "ft-dev-"));
mkdirSync(join(proj, "src"));
const manifest = {
  id: "reload-demo",
  name: "Reload Demo",
  description: "Live reload demo",
  version: "1.0.0",
  runtime: "webview-v1",
  entry: "index.html",
  category: "utility",
  estimatedDurationSeconds: 30,
  ageRating: "general",
  capabilities: [],
  network: { allowedDomains: [] },
  assets: {},
};
writeFileSync(join(proj, "src/manifest.json"), JSON.stringify(manifest));
writeFileSync(
  join(proj, "src/index.html"),
  '<!doctype html><title>x</title><h1 id="t">v1</h1><script src="app.js"></script>',
);
const app = (v: string) =>
  writeFileSync(
    join(proj, "src/app.js"),
    `document.getElementById("t").textContent="${v}";`,
  );
app("hello one");
writeFileSync(
  join(proj, "build.mjs"),
  `import {cpSync,rmSync} from "node:fs"; rmSync("dist",{recursive:true,force:true}); cpSync("src","dist",{recursive:true});`,
);
writeFileSync(
  join(proj, "package.json"),
  JSON.stringify({
    name: "reload-demo",
    private: true,
    type: "module",
    scripts: { build: "node build.mjs" },
  }),
);
writeFileSync(
  join(proj, "firsttry.json"),
  JSON.stringify({ outputDirectory: "dist", buildScript: "build" }),
);

const tsx = resolve(
  repo,
  "packages/mini-cli/node_modules/.bin",
  process.platform === "win32" ? "tsx.CMD" : "tsx",
);
const cli = spawn(
  tsx,
  [resolve(repo, "packages/mini-cli/src/index.ts"), "dev", ".", "--no-qr"],
  {
    cwd: proj,
    shell: process.platform === "win32",
    env: {
      ...process.env,
      // pnpm exports INIT_CWD; the CLI would otherwise work in the repo root.
      INIT_CWD: proj,
      FIRSTTRY_API: api,
      FIRSTTRY_TOKEN: minted.token,
      FIRSTTRY_WEB: "http://127.0.0.1:3000",
    },
  },
);
let log = "",
  link = "";
cli.stdout.on("data", (d) => {
  const t = String(d);
  log += "[out] " + t;
  const m = t.match(/firsttry:\/\/\S+/);
  if (m) link = m[0];
});
cli.stderr.on("data", (d) => (log += String(d)));
const until = async (re: RegExp, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (re.test(log)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

const checks: [string, boolean][] = [];
checks.push(["first build uploaded", await until(/build 1 uploaded/)]);
checks.push([
  "stable dev link printed",
  /^firsttry:\/\/preview\/[0-9a-f-]+\?dev=1$/.test(link),
]);
const appId = link.match(/preview\/([^?]+)/)![1];

// What the phone does: ask for the dev session, then long-poll for something newer.
const open = async () =>
  await (
    await fetch(api + "/sessions", {
      method: "POST",
      headers: { ...H, cookie },
      body: JSON.stringify({ appId, versionId: "dev", preview: true }),
    })
  ).json();
const s1 = await open();
checks.push([
  "host can open ?dev=1 session",
  s1.dev === true && s1.preview === true,
]);
const poll = fetch(
  `${api}/developer/apps/${appId}/dev/latest?after=${s1.versionId}&wait=20`,
  { headers: { ...H, cookie } },
).then((r) => r.json());

await new Promise((r) => setTimeout(r, 1200));
const t0 = Date.now();
app("hello two");
const changed = (await Promise.race([
  poll,
  new Promise((r) => setTimeout(() => r({ timeout: true }), 20000)),
])) as any;
checks.push([
  "edit pushes a new version to the poller",
  !!changed.versionId && changed.versionId !== s1.versionId,
]);
console.log("edit -> poller notified in", Date.now() - t0, "ms");
checks.push(["build 2 logged", await until(/build 2 uploaded/)]);

// Rapid saves coalesce; dist/ writes do not loop.
app("hello three");
app("hello four");
app("hello five");
await new Promise((r) => setTimeout(r, 4000));
const uploads = (log.match(/uploaded \(/g) ?? []).length;
checks.push([
  "rapid saves coalesced, no rebuild loop (uploads <= 4)",
  uploads >= 3 && uploads <= 4,
]);
console.log("uploads so far:", uploads);

// A broken build keeps watching and recovers.
writeFileSync(
  join(proj, "src/index.html"),
  '<!doctype html><script>fetch("https://x.example")</script>',
);
checks.push([
  "invalid bundle reported, process still alive",
  (await until(/✗ .*(Disallowed|network)/i)) && cli.exitCode === null,
]);
writeFileSync(
  join(proj, "src/index.html"),
  '<!doctype html><title>x</title><h1 id="t">ok</h1><script src="app.js"></script>',
);
checks.push(["recovers after fix", await until(/build 4 uploaded/)]);

// Identical content -> "no changes"
const before = (log.match(/uploaded \(/g) ?? []).length;
writeFileSync(
  join(proj, "src/app.js"),
  'document.getElementById("t").textContent="hello five";',
);
await new Promise((r) => setTimeout(r, 2500));
checks.push([
  "same bytes do not create a new build",
  (log.match(/uploaded \(/g) ?? []).length === before,
]);

const dev = await (
  await fetch(`${api}/developer/apps/${appId}/versions`, {
    headers: { ...H, cookie },
  })
).json();
checks.push(["dev builds invisible in releases list", dev.length === 0]);

cli.kill();
if (process.platform === "win32")
  spawn("taskkill", ["/pid", String(cli.pid), "/T", "/F"]);
console.log(
  "\n" +
    log
      .split("\n")
      .filter((l) => /↻|✗|·|Live|\[out\]/.test(l))
      .join("\n"),
);
console.log("\nRESULTS");
for (const [n, ok] of checks) console.log(ok ? "  PASS" : "  FAIL", n);
await system.app.close();
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);

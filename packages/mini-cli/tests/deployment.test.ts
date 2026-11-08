import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBundle } from "@firsttry/shared/bundle";
import {
  findReusableVersion,
  outputPath,
  parseDeploymentConfig,
} from "../src/deployment.js";

test("deployment settings reject traversal, absolute paths and command strings", () => {
  const root = resolve("fixture");
  assert.equal(
    outputPath(
      root,
      parseDeploymentConfig({
        outputDirectory: "dist",
        buildScript: "build:mini",
      }),
    ),
    join(root, "dist"),
  );
  for (const value of [
    { outputDirectory: "../other" },
    { outputDirectory: "C:\\secret" },
    { outputDirectory: "/secret" },
    { outputDirectory: "dist", buildScript: "build && echo bad" },
    { outputDirectory: "dist", unknown: true },
  ])
    assert.throws(() => outputPath(root, parseDeploymentConfig(value)));
});
test("repeated deployments reuse the same hash and reject conflicting immutable versions", () => {
  const version = { semver: "1.0.0", bundle_hash: "same" };
  assert.equal(findReusableVersion([version], "1.0.0", "same"), version);
  assert.equal(findReusableVersion([version], "1.0.1", "different"), undefined);
  assert.throws(
    () => findReusableVersion([version], "1.0.0", "different"),
    /Increment/,
  );
});
test("CLI builds, deploys, resumes, submits and enforces approval before publishing", async () => {
  const folder = await mkdtemp(join(tmpdir(), "firsttry-deploy-"));
  const cli = fileURLToPath(new URL("../src/index.ts", import.meta.url));
  const versions: any[] = [];
  let uploads = 0,
    releases = 0;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : {};
    res.setHeader("content-type", "application/json");
    const send = (data: unknown) => res.end(JSON.stringify(data));
    if (req.url === "/api/v1/auth/login") {
      res.setHeader("set-cookie", "session=fixture; HttpOnly");
      send({ name: "Developer" });
      return;
    }
    if (req.headers.cookie !== "session=fixture") {
      res.statusCode = 401;
      send({ error: "Sign in" });
      return;
    }
    if (req.url === "/api/v1/developer/apps") {
      send([{ id: "app-1", slug: "hello-mini" }]);
      return;
    }
    if (req.url?.endsWith("/versions")) {
      send(versions);
      return;
    }
    if (req.url?.endsWith("/upload")) {
      uploads++;
      const bundle = validateBundle(Buffer.from(body.zipBase64, "base64"));
      versions.push({
        id: "version-1",
        semver: bundle.manifest.version,
        bundle_hash: bundle.hash,
        review_status: "validated",
      });
      send({ id: "version-1", hash: bundle.hash, status: "validated" });
      return;
    }
    if (req.url?.endsWith("/submit-review")) {
      versions[0].review_status = "pending";
      send({ status: "pending" });
      return;
    }
    if (req.url?.endsWith("/release")) {
      releases++;
      assert.equal(versions[0].review_status, "approved");
      send({ published: true });
      return;
    }
    res.statusCode = 404;
    send({ error: "Unexpected request" });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address() as { port: number };
  const run = (args: string[]) =>
    new Promise<{ code: number | null; output: string }>((done, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", cli, ...args], {
        cwd: resolve(fileURLToPath(new URL("..", import.meta.url))),
        env: {
          ...process.env,
          INIT_CWD: folder,
          FIRSTTRY_API: `http://127.0.0.1:${address.port}/api/v1`,
          FIRSTTRY_PASSWORD: "fixture",
        },
        windowsHide: true,
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("error", reject);
      child.on("close", (code) => done({ code, output }));
    });
  try {
    await mkdir(join(folder, "public"));
    await writeFile(
      join(folder, "firsttry.json"),
      JSON.stringify({ outputDirectory: "public", buildScript: "build" }),
    );
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );
    await writeFile(
      join(folder, "public/index.html"),
      "<!doctype html><h1>Hello</h1>",
    );
    await writeFile(
      join(folder, "public/manifest.json"),
      JSON.stringify({
        id: "hello-mini",
        name: "Hello Mini",
        description: "Deployment test fixture",
        version: "1.0.0",
        runtime: "webview-v1",
        entry: "index.html",
        category: "utility",
        estimatedDurationSeconds: 30,
        ageRating: "general",
        capabilities: [],
        network: { allowedDomains: [] },
        assets: {},
      }),
    );
    assert.equal((await run(["login", "developer@fixture.local"])).code, 0);
    const first = await run(["deploy"]);
    assert.equal(first.code, 0, first.output);
    assert.match(first.output, /firsttry:\/\/preview\/app-1/);
    const repeat = await run(["deploy", "--submit"]);
    assert.equal(repeat.code, 0, repeat.output);
    assert.match(repeat.output, /"reused": true/);
    assert.equal(uploads, 1);
    assert.equal(versions[0].review_status, "pending");
    assert.match((await run(["inspect"])).output, /"status": "pending"/);
    assert.equal((await run(["publish"])).code, 1);
    assert.equal(releases, 0);
    versions[0].review_status = "approved";
    const published = await run(["publish"]);
    assert.equal(published.code, 0, published.output);
    assert.equal(releases, 1);
    assert.equal((await run(["rollback", "version-1"])).code, 0);
    assert.equal(releases, 2);
    await writeFile(
      join(folder, "public/index.html"),
      "<!doctype html><h1>Changed</h1>",
    );
    assert.match(
      (await run(["deploy"])).output,
      /Increment manifest.json version/,
    );
    assert.equal(uploads, 1);
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(7)"' } }),
    );
    const failure = await run(["deploy"]);
    assert.equal(failure.code, 1);
    assert.match(failure.output, /Build failed. Nothing uploaded/);
    assert.equal(uploads, 1);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    await rm(folder, { recursive: true, force: true });
  }
});

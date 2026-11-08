import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import { resolve, relative } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import { watch } from "node:fs";
import {
  readDeploymentConfig,
  outputPath,
  projectRoot,
  findReusableVersion,
} from "./deployment.js";
import { qrText } from "./qr.js";
import { zipSync } from "fflate";
import { validateBundle } from "@firsttry/shared/bundle";
const args = process.argv.slice(2),
  command = args.shift(),
  api = process.env.FIRSTTRY_API ?? "http://127.0.0.1:3001/api/v1",
  cwd = process.env.INIT_CWD ?? process.cwd(),
  configDir = resolve(cwd, ".firsttry");
// Credentials: FIRSTTRY_TOKEN (CI) wins, then the saved device-login token,
// then the legacy password-login cookie.
async function credentials(): Promise<Record<string, string>> {
  if (process.env.FIRSTTRY_TOKEN)
    return { authorization: "Bearer " + process.env.FIRSTTRY_TOKEN };
  try {
    const saved = JSON.parse(
      await readFile(resolve(configDir, "session.json"), "utf8"),
    );
    if (
      saved.api === api ||
      (!saved.api && api === "http://127.0.0.1:3001/api/v1")
    ) {
      if (saved.token) return { authorization: "Bearer " + saved.token };
      if (saved.cookie) return { cookie: saved.cookie };
    }
  } catch {}
  return {};
}
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(api + path, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      "x-firsttry-request": "1",
      ...(await credentials()),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(data.error);
  return { data, response };
}
async function saveReceipt(receipt: unknown) {
  await mkdir(configDir, { recursive: true });
  await writeFile(
    resolve(configDir, "deployment.json"),
    JSON.stringify(receipt, null, 2),
  );
}
async function receipt() {
  try {
    const data = JSON.parse(
      await readFile(resolve(configDir, "deployment.json"), "utf8"),
    );
    if (data.api !== api)
      throw new Error("Deployment belongs to a different API");
    return data;
  } catch (error: any) {
    throw new Error(
      "No deployment for this API in this directory. Deploy from here first. " +
        error.message,
    );
  }
}
async function zipDirectory(dir: string) {
  const files: Record<string, Uint8Array> = {};
  async function walk(path: string) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (entry.name.startsWith(".") || entry.name === "firsttry.json")
        continue;
      if (entry.isSymbolicLink()) throw new Error("Symlinks are not supported");
      const target = resolve(path, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", ".firsttry"].includes(entry.name))
          await walk(target);
      } else
        files[relative(dir, target).replaceAll("\\", "/")] =
          await readFile(target);
    }
  }
  await walk(dir);
  return zipSync(files, { mtime: new Date("2020-01-01T00:00:00Z") });
}
// Resolves the project folder and output directory, refusing anything that
// escapes the checkout (including through symlinks).
async function resolveProject(dir: string) {
  const config = await readDeploymentConfig(dir);
  // rootDirectory lets a repository-root firsttry.json point at a subfolder.
  const project = projectRoot(dir, config);
  const output = outputPath(project, config);
  const realBase = await realpath(dir);
  projectRoot(realBase, {
    outputDirectory: ".",
    rootDirectory: relative(realBase, await realpath(project)) || ".",
  });
  return { config, project, output };
}
function runBuild(project: string, script: string) {
  console.error("Building project: " + script);
  const build = spawnSync(process.execPath, ["--run", script], {
    cwd: project,
    stdio: ["inherit", "inherit", "inherit"],
    windowsHide: true,
  });
  if (build.error || build.status !== 0)
    throw new Error("Build failed. " + (build.error?.message ?? ""));
}
// A symlinked output must not package files from outside the project.
async function checkOutput(project: string, output: string) {
  outputPath(await realpath(project), {
    outputDirectory:
      relative(await realpath(project), await realpath(output)) || ".",
  });
}
async function ensureApp(manifest: {
  id: string;
  name: string;
  description: string;
  category: string;
}) {
  const apps = (await request("/developer/apps")).data;
  return (
    apps.find((a: any) => a.slug === manifest.id) ??
    (
      await request("/developer/apps", "POST", {
        slug: manifest.id,
        title: manifest.name,
        summary: manifest.description,
        category: manifest.category,
      })
    ).data
  );
}
const webOrigin = () => process.env.FIRSTTRY_WEB ?? "http://127.0.0.1:3000";
try {
  if (command === "init") {
    const name = args[0] ?? "my-first-mini";
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(name))
      throw new Error("Use a lowercase slug");
    const target = resolve(cwd, name);
    await mkdir(target, { recursive: false });
    await writeFile(
      resolve(target, ".gitignore"),
      "node_modules/\ndist/\n.firsttry/\n.env*\n",
    );
    await writeFile(
      resolve(target, "firsttry.json"),
      JSON.stringify(
        args.includes("--vite")
          ? { outputDirectory: "dist", buildScript: "build" }
          : { outputDirectory: "." },
        null,
        2,
      ),
    );
    const manifest = {
      id: name,
      name: "My first mini",
      description: "A little thing worth trying",
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
    await writeFile(
      resolve(target, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    await writeFile(
      resolve(target, "index.html"),
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><title>My first mini</title></head><body><h1>A little idea starts here.</h1><button id="try">Try it</button><p id="result"></p><script src="app.js"></script></body></html>',
    );
    await writeFile(
      resolve(target, "style.css"),
      "body{font:18px system-ui;text-align:center;padding:40px;background:#eef5eb;color:#17442c}button{font:inherit;padding:16px;border:0;border-radius:12px;background:#078b4e;color:white}",
    );
    await writeFile(
      resolve(target, "app.js"),
      'document.getElementById("try").addEventListener("click",()=>{document.getElementById("result").textContent="Your idea is working!";});',
    );
    if (args.includes("--vite")) {
      await mkdir(resolve(target, "public"));
      await mkdir(resolve(target, "src"));
      await writeFile(
        resolve(target, "public/manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
      await writeFile(
        resolve(target, "src/main.ts"),
        'import "../style.css"; document.getElementById("try")!.addEventListener("click",()=>{document.getElementById("result")!.textContent="Your TypeScript mini-app is working!";});',
      );
      await writeFile(
        resolve(target, "index.html"),
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>My first mini</title></head><body><h1>A little idea starts here.</h1><button id="try">Try it</button><p id="result"></p><script type="module" src="/src/main.ts"></script></body></html>',
      );
      await writeFile(
        resolve(target, "package.json"),
        JSON.stringify(
          {
            name,
            private: true,
            type: "module",
            scripts: { dev: "vite --host 127.0.0.1", build: "vite build" },
            devDependencies: { vite: "^7.3.0", typescript: "^5.9.3" },
          },
          null,
          2,
        ),
      );
      await writeFile(
        resolve(target, "vite.config.ts"),
        'export default { build: { modulePreload: false, target: "es2020" } };',
      );
      await writeFile(
        resolve(target, "pnpm-workspace.yaml"),
        "packages: []\nallowBuilds:\n  esbuild: true\n",
      );
    }
    console.log(
      "Created " +
        target +
        ". " +
        (args.includes("--vite")
          ? "Install dependencies once with pnpm --dir " + name + " install. "
          : "") +
        "Then: pnpm cli deploy " +
        name,
    );
  } else if (command === "dev") {
    // Live reload: rebuild on change and upload a throwaway dev build. The
    // Android host opens firsttry://preview/<app>?dev=1 and reloads itself.
    const dir = resolve(cwd, args.find((a) => !a.startsWith("--")) ?? ".");
    for (const flag of args.filter((arg) => arg.startsWith("--")))
      if (!["--no-qr", "--once"].includes(flag))
        throw new Error("Unknown option " + flag);
    const { config, project, output } = await resolveProject(dir);
    const outputRelative = relative(project, output);
    let app: any;
    let builds = 0;
    const cycle = async () => {
      const started = Date.now();
      try {
        if (config.buildScript) runBuild(project, config.buildScript);
        await checkOutput(project, output);
        const zip = await zipDirectory(output);
        const validated = validateBundle(zip);
        app ??= await ensureApp(validated.manifest);
        const upload = (
          await request("/developer/apps/" + app.id + "/upload", "POST", {
            zipBase64: Buffer.from(zip).toString("base64"),
            dev: true,
          })
        ).data;
        const time = new Date().toLocaleTimeString();
        if (upload.reused) console.error("· " + time + " no changes");
        else
          console.error(
            "↻ " +
              time +
              " build " +
              ++builds +
              " uploaded (" +
              Object.keys(validated.files).length +
              " files, " +
              Math.round(zip.length / 1024) +
              " KB, " +
              (Date.now() - started) +
              " ms); open devices reload.",
          );
        return true;
      } catch (e: any) {
        // Keep watching: fix the error and save again.
        console.error("✗ " + new Date().toLocaleTimeString() + " " + e.message);
        return false;
      }
    };
    const ok = await cycle();
    if (!app)
      throw new Error(
        "Could not start: fix the error above and run dev again.",
      );
    const link = "firsttry://preview/" + app.id + "?dev=1";
    console.log(link);
    console.error(
      "\nLive reload for " +
        app.slug +
        (ok ? "" : " (waiting for a valid build)") +
        ". Open this on a phone signed in as the developer; it reloads on every save.\n" +
        (!args.includes("--no-qr") && process.stderr.isTTY
          ? qrText(link) + "\n"
          : "") +
        link +
        "\nPreview page: " +
        webOrigin() +
        "/preview?app=" +
        app.id +
        "&dev=1\nWatching " +
        project +
        " (Ctrl+C to stop)",
    );
    if (!args.includes("--once")) {
      let timer: NodeJS.Timeout | undefined,
        running = false,
        pending = false;
      const run = async () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        do {
          pending = false;
          await cycle();
        } while (pending);
        running = false;
      };
      const ignored = (name: string) => {
        const parts = name.split(/[\\/]/);
        return (
          parts.some((p) => p.startsWith(".") || p === "node_modules") ||
          /\.(log|tsbuildinfo)$/.test(name) ||
          (outputRelative !== "" &&
            outputRelative !== "." &&
            (name === outputRelative ||
              name.startsWith(outputRelative + "/") ||
              name.startsWith(outputRelative + "\\")))
        );
      };
      watch(project, { recursive: true }, (_event, name) => {
        if (!name || ignored(name.toString())) return;
        clearTimeout(timer);
        timer = setTimeout(run, 250);
      });
      await new Promise(() => {});
    }
  } else if (command === "validate" || command === "deploy") {
    const dir = resolve(cwd, args.find((a) => !a.startsWith("--")) ?? ".");
    for (const flag of args.filter((arg) => arg.startsWith("--"))) {
      if (!["--skip-build", "--submit", "--no-qr"].includes(flag))
        throw new Error("Unknown option " + flag);
    }
    const { config, project, output } = await resolveProject(dir);
    if (config.buildScript && !args.includes("--skip-build")) {
      try {
        runBuild(project, config.buildScript);
      } catch (e: any) {
        throw new Error(
          e.message.replace("Build failed.", "Build failed. Nothing uploaded."),
        );
      }
    }
    await checkOutput(project, output);
    console.error("Validating " + output);
    const zip = await zipDirectory(output);
    const validated = validateBundle(zip);
    if (command === "validate") {
      console.log(
        "VALID " +
          validated.manifest.id +
          " v" +
          validated.manifest.version +
          " " +
          validated.hash,
      );
      await writeFile(
        resolve(configDir, "last-validation.json"),
        JSON.stringify({ hash: validated.hash }),
      ).catch(() => {});
    } else {
      const app = await ensureApp(validated.manifest);
      const versions = (
        await request("/developer/apps/" + app.id + "/versions")
      ).data;
      const existing = findReusableVersion(
        versions,
        validated.manifest.version,
        validated.hash,
      );
      const upload = existing
        ? {
            id: existing.id,
            status: existing.review_status,
            hash: existing.bundle_hash,
          }
        : (
            await request("/developer/apps/" + app.id + "/upload", "POST", {
              zipBase64: Buffer.from(zip).toString("base64"),
            })
          ).data;
      // Persist before optional submission so a failed request can be inspected/retried.
      const deployment = {
        ...upload,
        appId: app.id,
        slug: app.slug,
        version: validated.manifest.version,
        api,
        visibility: "private",
        reused: !!existing,
        previewLink: "firsttry://preview/" + app.id + "?version=" + upload.id,
        previewPage:
          webOrigin() + "/preview?app=" + app.id + "&version=" + upload.id,
      };
      await saveReceipt(deployment);
      if (args.includes("--submit") && upload.status === "validated") {
        await request(
          "/developer/apps/" +
            app.id +
            "/versions/" +
            upload.id +
            "/submit-review",
          "POST",
        );
        deployment.status = "pending";
        await saveReceipt(deployment);
      }
      console.log(JSON.stringify(deployment, null, 2));
      console.error(
        "Private preview ready. Sign in as the developer in the Android host. Next: pnpm cli inspect / pnpm cli submit. Public publication requires approval.",
      );
      if (!args.includes("--no-qr") && process.stderr.isTTY)
        console.error(
          "\nScan with a phone that has the FirstTry host installed:\n" +
            qrText(deployment.previewLink) +
            "\n" +
            deployment.previewLink,
        );
    }
  } else if (command === "login" && !args[0]) {
    // Browser/device login: approve the code in the web dashboard.
    const start = (await request("/auth/device", "POST", {})).data;
    console.error(
      "Open " +
        start.verificationUri +
        "?code=" +
        start.userCode +
        "\nand approve this code: " +
        start.userCode +
        "\nWaiting for approval (Ctrl+C to cancel)...",
    );
    const deadline = Date.now() + start.expiresIn * 1000;
    let token: { token: string; expiresAt: number } | undefined;
    while (!token && Date.now() < deadline) {
      await sleep(start.interval * 1000);
      try {
        token = (
          await request("/auth/device/token", "POST", {
            deviceCode: start.deviceCode,
          })
        ).data;
      } catch (error: any) {
        if (error.message !== "authorization_pending") throw error;
      }
    }
    if (!token) throw new Error("Login code expired. Run login again.");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      resolve(configDir, "session.json"),
      JSON.stringify({
        token: token.token,
        api,
        expiresAt: token.expiresAt,
      }),
      { mode: 0o600 },
    );
    const me = (await request("/me")).data;
    console.log("Signed in as " + me.name);
  } else if (command === "whoami") {
    const me = (await request("/me")).data;
    console.log(me.name + " (" + me.role + ")");
  } else if (command === "logout") {
    // Revoke the stored token server-side, then forget it locally.
    try {
      if (!process.env.FIRSTTRY_TOKEN)
        await request("/developer/tokens/current", "DELETE");
    } catch {}
    await rm(resolve(configDir, "session.json"), { force: true });
    console.log("Signed out.");
  } else if (command === "token") {
    const sub = args.shift();
    if (sub === "create") {
      const name = args.find((a) => !a.startsWith("--"));
      const days = args.indexOf("--days");
      if (!name) throw new Error("Usage: token create <name> [--days 90]");
      const made = (
        await request("/developer/tokens", "POST", {
          name,
          ...(days >= 0 ? { expiresInDays: Number(args[days + 1]) } : {}),
        })
      ).data;
      console.log(made.token);
      console.error(
        "Deploy token '" +
          made.name +
          "' created (previews and review requests only). Store it as the FIRSTTRY_TOKEN secret in CI; it is shown once.",
      );
    } else if (sub === "list")
      console.log(
        JSON.stringify((await request("/developer/tokens")).data, null, 2),
      );
    else if (sub === "revoke" && args[0]) {
      await request("/developer/tokens/" + args[0], "DELETE");
      console.log("Token revoked.");
    } else throw new Error("Usage: token create <name> | list | revoke <id>");
  } else if (command === "login") {
    const email = args[0],
      password = process.env.FIRSTTRY_PASSWORD;
    if (!email || !password)
      throw new Error(
        "Usage: set FIRSTTRY_PASSWORD for this process, then cli login email. Do not put passwords in command arguments.",
      );
    const { data, response } = await request("/auth/login", "POST", {
      email,
      password,
    });
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      resolve(configDir, "session.json"),
      JSON.stringify({ cookie, api }),
      { mode: 0o600 },
    );
    console.log("Signed in as " + data.name);
  } else if (
    ["inspect", "submit", "publish", "rollback"].includes(command ?? "")
  ) {
    const deployment = await receipt();
    const versions = (
      await request("/developer/apps/" + deployment.appId + "/versions")
    ).data;
    const versionId = args[0] ?? deployment.id;
    const version = versions.find((item: any) => item.id === versionId);
    if (!version)
      throw new Error(
        "Version does not belong to this app. Use inspect to list versions.",
      );
    if (command === "inspect") {
      console.log(
        JSON.stringify(
          {
            ...deployment,
            status: version.review_status,
            reviewReason: version.review_reason,
            versions,
          },
          null,
          2,
        ),
      );
    } else if (command === "submit") {
      if (version.review_status === "validated")
        await request(
          "/developer/apps/" +
            deployment.appId +
            "/versions/" +
            versionId +
            "/submit-review",
          "POST",
        );
      else if (version.review_status !== "pending")
        throw new Error(
          "Only validated versions can be submitted. Current status: " +
            version.review_status,
        );
      console.log("Version submitted; awaiting moderator review.");
    } else {
      if (command === "rollback" && !args[0])
        throw new Error(
          "Usage: rollback <approved-version-id>. Inspect lists available versions.",
        );
      if (version.review_status !== "approved")
        throw new Error(
          "Only approved versions can be published. Current status: " +
            version.review_status,
        );
      await request(
        "/developer/apps/" + deployment.appId + "/release",
        "POST",
        { versionId },
      );
      console.log(
        "Published approved version " +
          version.semver +
          ". Public app: firsttry://mini/" +
          deployment.slug,
      );
    }
  } else if (command === "status")
    console.log(
      JSON.stringify((await request("/developer/apps")).data, null, 2),
    );
  else
    console.log(
      "FirstTry CLI: init <slug> [--vite] | login [email] | logout | whoami | token create|list|revoke | dev [project] | validate <project> | deploy <project> [--submit] [--skip-build] [--no-qr] | inspect | submit | publish [version-id] | rollback <approved-version-id> | status\nCI: set FIRSTTRY_TOKEN (a deploy token) and FIRSTTRY_API.",
    );
} catch (e: any) {
  console.error("FirstTry: " + e.message);
  process.exitCode = 1;
}

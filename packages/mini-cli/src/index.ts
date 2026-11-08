import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  realpath,
} from "node:fs/promises";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import {
  readDeploymentConfig,
  outputPath,
  findReusableVersion,
} from "./deployment.js";
import { zipSync } from "fflate";
import { validateBundle } from "@firsttry/shared/bundle";
const args = process.argv.slice(2),
  command = args.shift(),
  api = process.env.FIRSTTRY_API ?? "http://127.0.0.1:3001/api/v1",
  cwd = process.env.INIT_CWD ?? process.cwd(),
  configDir = resolve(cwd, ".firsttry");
async function request(path: string, method = "GET", body?: unknown) {
  let session = "";
  try {
    const saved = JSON.parse(
      await readFile(resolve(configDir, "session.json"), "utf8"),
    );
    if (
      saved.api === api ||
      (!saved.api && api === "http://127.0.0.1:3001/api/v1")
    )
      session = saved.cookie;
  } catch {}
  const response = await fetch(api + path, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      "content-type": "application/json",
      "x-firsttry-request": "1",
      cookie: session,
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
  } else if (command === "validate" || command === "deploy") {
    const dir = resolve(cwd, args.find((a) => !a.startsWith("--")) ?? ".");
    for (const flag of args.filter((arg) => arg.startsWith("--"))) {
      if (!["--skip-build", "--submit"].includes(flag))
        throw new Error("Unknown option " + flag);
    }
    const config = await readDeploymentConfig(dir);
    const output = outputPath(dir, config);
    if (config.buildScript && !args.includes("--skip-build")) {
      console.error("Building project: " + config.buildScript);
      const build = spawnSync(process.execPath, ["--run", config.buildScript], {
        cwd: dir,
        stdio: ["inherit", "inherit", "inherit"],
        windowsHide: true,
      });
      if (build.error || build.status !== 0)
        throw new Error(
          "Build failed. Nothing uploaded. " + (build.error?.message ?? ""),
        );
    }
    // A symlinked output must not package files from outside the project.
    outputPath(await realpath(dir), {
      outputDirectory:
        relative(await realpath(dir), await realpath(output)) || ".",
    });
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
      let apps = (await request("/developer/apps")).data;
      let app = apps.find((a: any) => a.slug === validated.manifest.id);
      if (!app)
        app = (
          await request("/developer/apps", "POST", {
            slug: validated.manifest.id,
            title: validated.manifest.name,
            summary: validated.manifest.description,
            category: validated.manifest.category,
          })
        ).data;
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
    }
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
      "FirstTry local CLI: init <slug> [--vite] | validate <project> | login <email> | deploy <project> [--submit] [--skip-build] | inspect | submit | publish [version-id] | rollback <approved-version-id> | status",
    );
} catch (e: any) {
  console.error("FirstTry: " + e.message);
  process.exitCode = 1;
}

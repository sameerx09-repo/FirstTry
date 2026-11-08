import { randomUUID } from "node:crypto";
import { Database } from "./db.js";
import {
  BundleStore,
  makeZip,
  passwordHash,
  validateBundle,
} from "./bundles.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { root } from "./db.js";
export const localPassword = "FirstTry-local-2026!";
export async function seed(db: Database, store: BundleStore) {
  for (const [id, email, name, role] of [
    ["dev-a", "developer@firsttry.local", "FirstTry Studio", "developer"],
    ["dev-b", "other@firsttry.local", "Other Studio", "developer"],
    ["admin", "admin@firsttry.local", "Local Moderator", "admin"],
    ["consumer", "consumer@firsttry.local", "Explorer", "consumer"],
  ])
    await db.query(
      "INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
      [id, email, name, role, passwordHash(localPassword)],
    );
  const catalog = [
    [
      "color-clash",
      "Color Clash",
      "Match colors. Beat the clock.",
      "games",
      "▦",
      "#8655ed",
      30,
    ],
    [
      "tap-reflex",
      "Tap Reflex",
      "How quick are your reactions?",
      "games",
      "ϟ",
      "#8b5cf6",
      30,
    ],
    [
      "decision-spinner",
      "Decision Spinner",
      "Let chance make the call.",
      "utility",
      "◉",
      "#f06a82",
      60,
    ],
    [
      "focus-sprint",
      "Focus Sprint",
      "A little focus goes a long way.",
      "utility",
      "♧",
      "#70bc43",
      300,
    ],
    [
      "tiny-quiz",
      "Tiny Quiz",
      "A little curiosity, every day.",
      "games",
      "?",
      "#f3b636",
      120,
    ],
    [
      "meme-remix",
      "Meme Remix",
      "Make a little everyday comedy.",
      "creative",
      "☺",
      "#ee8563",
      60,
    ],
  ] as const;
  const css = await readFile(
    resolve(root, "packages/mini-examples/runtime/mini.css"),
    "utf8",
  );
  const js = await readFile(
    resolve(root, "packages/mini-examples/runtime/mini.js"),
    "utf8",
  );
  for (const [
    slug,
    title,
    summary,
    category,
    icon,
    color,
    duration,
  ] of catalog) {
    const existing = await db.query("SELECT id FROM apps WHERE slug=$1", [
      slug,
    ]);
    if (existing.length) continue;
    const appId = randomUUID(),
      versionId = randomUUID();
    const manifest = {
      id: slug,
      name: title,
      description: summary,
      version: "1.0.0",
      runtime: "webview-v1",
      entry: "index.html",
      category,
      estimatedDurationSeconds: duration,
      ageRating: "general",
      capabilities: ["host.analytics", "host.feedback", "host.close"],
      network: { allowedDomains: [] },
      assets: {},
    };
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="mini.css"><title>${title}</title></head><body data-app="${slug}"><main id="app"></main><script src="mini.js"></script></body></html>`;
    const zip = makeZip({
      "manifest.json": JSON.stringify(manifest),
      "index.html": html,
      "mini.css": css,
      "mini.js": js,
    });
    const bundle = validateBundle(zip);
    await store.put(bundle.hash, zip);
    await db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO apps(id,developer_id,slug,title,summary,category,icon,color,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          appId,
          "dev-a",
          slug,
          title,
          summary,
          category,
          icon,
          color,
          slug === "color-clash",
        ],
      );
      await tx.query(
        "INSERT INTO versions(id,app_id,semver,bundle_hash,manifest,files,review_status,seed) VALUES($1,$2,$3,$4,$5,$6,'approved',true)",
        [
          versionId,
          appId,
          "1.0.0",
          bundle.hash,
          JSON.stringify(manifest),
          JSON.stringify(bundle.inventory),
        ],
      );
      await tx.query("INSERT INTO releases(app_id,version_id) VALUES($1,$2)", [
        appId,
        versionId,
      ]);
      await tx.query(
        "INSERT INTO audit(id,actor,action,app_id,version_id,reason) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          "admin",
          "seed-approved",
          appId,
          versionId,
          "Bundled first-party local development content",
        ],
      );
    });
  }
}

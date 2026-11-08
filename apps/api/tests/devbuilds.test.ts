import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../src/app.js";
import { makeZip } from "../src/bundles.js";
import { localPassword } from "../src/seeds.js";

let system: Awaited<ReturnType<typeof createApp>>,
  dev = "",
  other = "",
  appId = "";
const slug = "live-reload";

async function call(url: string, method: any = "GET", body?: any, cookie = "") {
  const r = await system.app.inject({
    url: "/api/v1" + url,
    method,
    headers: { "x-firsttry-request": "1", ...(cookie ? { cookie } : {}) },
    ...(body !== undefined ? { payload: body } : {}),
  });
  return {
    status: r.statusCode,
    data: r.headers["content-type"]?.includes("json") ? r.json() : r.rawPayload,
    cookie: r.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
}
const login = async (email: string) =>
  (await call("/auth/login", "POST", { email, password: localPassword }))
    .cookie;
const zip = (text: string, version = "1.0.0") =>
  Buffer.from(
    makeZip({
      "manifest.json": JSON.stringify({
        id: slug,
        name: "Live Reload",
        description: "A hot reload test",
        version,
        runtime: "webview-v1",
        entry: "index.html",
        category: "games",
        estimatedDurationSeconds: 30,
        ageRating: "general",
        capabilities: [],
        network: { allowedDomains: [] },
        assets: {},
      }),
      "index.html":
        '<!doctype html><title>T</title><script src="a.js"></script>',
      "a.js": `document.body.textContent=${JSON.stringify(text)};`,
    }),
  ).toString("base64");
const upload = (text: string, isDev: boolean, version?: string, cookie = dev) =>
  call(
    `/developer/apps/${appId}/upload`,
    "POST",
    { zipBase64: zip(text, version), dev: isDev },
    cookie,
  );

beforeAll(async () => {
  system = await createApp({ memory: true });
  dev = await login("developer@firsttry.local");
  other = await login("other@firsttry.local");
  appId = (
    await call(
      "/developer/apps",
      "POST",
      {
        slug,
        title: "Live Reload",
        summary: "A hot reload test",
        category: "games",
      },
      dev,
    )
  ).data.id;
});
afterAll(async () => system.app.close());

describe("dev builds", () => {
  it("accepts repeated builds with the same semver and reuses identical bytes", async () => {
    const a = await upload("one", true);
    const b = await upload("two", true);
    const again = await upload("two", true);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data.id).not.toBe(b.data.id);
    expect(again.data.id).toBe(b.data.id);
    expect(again.data.reused).toBe(true);
    expect(b.data.status).toBe("dev");
  });

  it("never shows up as a release, cannot be reviewed or published", async () => {
    const dv = (await upload("three", true)).data;
    const versions = (
      await call(`/developer/apps/${appId}/versions`, "GET", undefined, dev)
    ).data;
    expect(versions.map((v: any) => v.id)).not.toContain(dv.id);
    expect(
      (
        await call(
          `/developer/apps/${appId}/versions/${dv.id}/submit-review`,
          "POST",
          {},
          dev,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/developer/apps/${appId}/release`,
          "POST",
          { versionId: dv.id },
          dev,
        )
      ).status,
    ).toBe(403);
    const catalog = (await call("/catalog?q=Live+Reload", "GET")).data;
    expect(catalog.items).toHaveLength(0);
  });

  it("release versions still enforce unique semvers", async () => {
    expect((await upload("rel", false, "1.0.0")).status).toBe(200);
    expect((await upload("rel2", false, "1.0.0")).status).toBe(409);
    expect((await upload("rel2", false, "1.0.1")).status).toBe(200);
  });

  it("the 'dev' preview resolves to the newest build and is owner-only", async () => {
    const newest = (await upload("newest", true)).data;
    const s = await call(
      "/sessions",
      "POST",
      { appId, versionId: "dev", preview: true },
      dev,
    );
    expect(s.status).toBe(200);
    expect(s.data.versionId).toBe(newest.id);
    expect(s.data.dev).toBe(true);
    expect(s.data.preview).toBe(true);
    expect(
      (
        await call(
          "/sessions",
          "POST",
          { appId, versionId: "dev", preview: true },
          other,
        )
      ).status,
    ).toBe(404);
    // A public session can never be created for a dev build.
    expect(
      (
        await call(
          "/sessions",
          "POST",
          { appId, versionId: newest.id, preview: false },
          dev,
        )
      ).status,
    ).toBe(403);
  });

  it("long-polls until a newer build exists", async () => {
    const current = (await upload("poll-base", true)).data;
    const idle = await call(
      `/developer/apps/${appId}/dev/latest?after=${current.id}&wait=0`,
      "GET",
      undefined,
      dev,
    );
    expect(idle.data.versionId).toBeNull();
    const waiting = call(
      `/developer/apps/${appId}/dev/latest?after=${current.id}&wait=5`,
      "GET",
      undefined,
      dev,
    );
    await new Promise((r) => setTimeout(r, 600));
    const next = (await upload("poll-next", true)).data;
    const result = await waiting;
    expect(result.data.versionId).toBe(next.id);
    expect(
      (
        await call(
          `/developer/apps/${appId}/dev/latest?wait=0`,
          "GET",
          undefined,
          other,
        )
      ).status,
    ).toBe(404);
  });

  it("keeps only the newest 20 builds and prunes their sessions", async () => {
    const oldest = (await upload("prune oldest", true)).data;
    const session = await call(
      "/sessions",
      "POST",
      { appId, versionId: oldest.id, preview: true },
      dev,
    );
    expect(session.status).toBe(200);
    for (let i = 0; i < 24; i++) await upload("bulk " + i, true);
    const count = async (sql: string) =>
      Number((await system.db.query(sql, [appId]))[0].n);
    expect(
      await count(
        "SELECT count(*) n FROM versions WHERE app_id=$1 AND dev=true",
      ),
    ).toBe(20);
    expect(
      await count(
        "SELECT count(*) n FROM sessions WHERE app_id=$1 AND version_id NOT IN(SELECT id FROM versions WHERE app_id=$1)",
      ),
    ).toBe(0);
    // The pruned build is gone, and the release versions are untouched.
    expect(
      (
        await call(
          "/sessions",
          "POST",
          { appId, versionId: oldest.id, preview: true },
          dev,
        )
      ).status,
    ).toBe(403);
    expect(
      await count(
        "SELECT count(*) n FROM versions WHERE app_id=$1 AND dev=false",
      ),
    ).toBe(2);
  });
});

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { makeZip, validateBundle, sha } from "../src/bundles.js";
import { localPassword } from "../src/seeds.js";
import { manifestSchema, canTransition } from "@firsttry/shared";
let system: Awaited<ReturnType<typeof createApp>>,
  dev = "",
  other = "",
  admin = "",
  guest = "";
async function call(
  url: string,
  method: any = "GET",
  body?: any,
  cookie = "",
  token = "",
) {
  const r = await system.app.inject({
    url: "/api/v1" + url,
    method,
    headers: {
      "x-firsttry-request": "1",
      ...(cookie ? { cookie } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    ...(body !== undefined ? { payload: body } : {}),
  });
  return {
    status: r.statusCode,
    data: r.headers["content-type"]?.includes("json") ? r.json() : r.rawPayload,
    cookie: r.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
}
const manifest = (slug: string, version = "1.0.0") => ({
  id: slug,
  name: "Test Mini",
  description: "A useful test app",
  version,
  runtime: "webview-v1",
  entry: "index.html",
  category: "games",
  estimatedDurationSeconds: 30,
  ageRating: "general",
  capabilities: ["host.analytics"],
  network: { allowedDomains: [] },
  assets: {},
});
const bundle = (
  slug: string,
  version = "1.0.0",
  script = 'document.body.textContent="Working mini-app";',
) =>
  makeZip({
    "manifest.json": JSON.stringify(manifest(slug, version)),
    "index.html":
      '<!doctype html><title>Test</title><script src="app.js"></script>',
    "app.js": script,
  });
async function create(slug: string) {
  return (
    await call(
      "/developer/apps",
      "POST",
      {
        slug,
        title: "Test Mini",
        summary: "A useful test app",
        category: "games",
      },
      dev,
    )
  ).data;
}
async function upload(id: string, slug: string, version = "1.0.0") {
  return call(
    "/developer/apps/" + id + "/upload",
    "POST",
    { zipBase64: Buffer.from(bundle(slug, version)).toString("base64") },
    dev,
  );
}
async function approve(id: string, vid: string) {
  expect(
    (
      await call(
        `/developer/apps/${id}/versions/${vid}/submit-review`,
        "POST",
        {},
        dev,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await call(
        `/admin/reviews/${vid}/decision`,
        "POST",
        { decision: "approved", reason: "Functionality and content reviewed" },
        admin,
      )
    ).status,
  ).toBe(200);
}
async function publish(id: string, vid: string) {
  return call(
    "/developer/apps/" + id + "/release",
    "POST",
    { versionId: vid },
    dev,
  );
}
beforeAll(async () => {
  system = await createApp({ memory: true });
  for (const [email, assign] of [
    ["developer@firsttry.local", (v: string) => (dev = v)],
    ["other@firsttry.local", (v: string) => (other = v)],
    ["admin@firsttry.local", (v: string) => (admin = v)],
  ] as const) {
    const r = await call("/auth/login", "POST", {
      email,
      password: localPassword,
    });
    expect(r.status).toBe(200);
    assign(r.cookie);
  }
  guest = (await call("/auth/guest", "POST", {})).cookie;
}, 30000);
afterAll(async () => {
  await system.app.close();
});
describe("runtime contracts and hostile archives", () => {
  it("rejects native capabilities and network destinations", () => {
    expect(() =>
      manifestSchema.parse({ ...manifest("bad"), capabilities: ["camera"] }),
    ).toThrow();
    expect(() =>
      manifestSchema.parse({
        ...manifest("bad"),
        network: { allowedDomains: ["evil.example"] },
      }),
    ).toThrow();
  });
  it("enforces review transitions", () => {
    expect(canTransition("validated", "approved")).toBe(false);
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(false);
  });
  it("rejects traversal and native payloads", () => {
    expect(() => validateBundle(makeZip({ "../evil.js": "x" }))).toThrow();
    expect(() => validateBundle(makeZip({ "payload.dex": "x" }))).toThrow();
  });
  it("rejects compressed expansion bombs", () => {
    expect(() =>
      validateBundle(makeZip({ "huge.js": "x".repeat(3 * 1024 * 1024) })),
    ).toThrow("Archive expansion");
  });
  it("rejects remote scripts, eval, inline handlers and runtime fetch", () => {
    for (const source of [
      'eval("x")',
      'fetch("/secret")',
      'new WebSocket("bad")',
    ])
      expect(() =>
        validateBundle(bundle("hostile", "1.0.0", source)),
      ).toThrow();
    expect(() =>
      validateBundle(
        makeZip({
          "manifest.json": JSON.stringify(manifest("bad")),
          "index.html": '<script src="https://evil.example/x.js"></script>',
        }),
      ),
    ).toThrow();
  });
  it("signatures detect tampering", () => {
    const grant = system.keys.seal({ appId: "x" });
    expect(system.keys.verify(grant.payload, grant.signature)).toBe(true);
    expect(system.keys.verify(grant.payload + "a", grant.signature)).toBe(
      false,
    );
  });
});
describe("real PostgreSQL API workflows", () => {
  it("seeds six approved playable experiences", async () => {
    const r = await call("/catalog");
    expect(r.status).toBe(200);
    expect(r.data.items).toHaveLength(6);
    for (const a of r.data.items) {
      expect(a.manifest.runtime).toBe("webview-v1");
      const p = await system.app.inject(
        "/seed-preview/" + a.slug + "/index.html",
      );
      expect(p.statusCode).toBe(200);
      expect(p.headers["content-security-policy"]).toContain(
        "connect-src 'none'",
      );
    }
  });
  it("requires mutation header and denies cross-origin requests", async () => {
    expect(
      (await system.app.inject({ url: "/api/v1/auth/guest", method: "POST" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await system.app.inject({
          url: "/api/v1/auth/guest",
          method: "POST",
          headers: {
            "x-firsttry-request": "1",
            origin: "https://evil.example",
          },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("enforces roles and ownership", async () => {
    expect((await call("/admin/reviews", "GET", undefined, dev)).status).toBe(
      403,
    );
    expect((await call("/developer/apps")).status).toBe(401);
    const apps = (await call("/developer/apps", "GET", undefined, dev)).data;
    expect(
      (
        await call(
          "/developer/apps/" + apps[0].id + "/analytics",
          "GET",
          undefined,
          other,
        )
      ).status,
    ).toBe(404);
  });
  it("rejects invalid login and overlong feedback", async () => {
    expect(
      (
        await call("/auth/login", "POST", {
          email: "developer@firsttry.local",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    const a = (await call("/catalog")).data.items[0];
    expect(
      (
        await call(
          "/apps/" + a.id + "/feedback",
          "POST",
          { rating: "up", body: "x".repeat(141) },
          guest,
        )
      ).status,
    ).toBe(400);
  });
  it("executes upload -> preview -> review -> publish -> events -> feedback -> rollback -> takedown", async () => {
    const a = await create("workflow-mini");
    const uploaded = await upload(a.id, "workflow-mini");
    expect(uploaded.status).toBe(200);
    const vid = uploaded.data.id;
    expect((await call("/catalog/workflow-mini")).status).toBe(404);
    expect((await publish(a.id, vid)).status).toBe(403);
    expect(
      (
        await call(
          "/sessions",
          "POST",
          { appId: a.id, versionId: vid, preview: true },
          other,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call(
          "/sessions",
          "POST",
          { appId: a.id, versionId: vid, preview: true },
          dev,
        )
      ).status,
    ).toBe(200);
    await approve(a.id, vid);
    const releaseVersions = async () =>
      (
        await call(
          "/developer/apps/" + a.id + "/versions",
          "GET",
          undefined,
          dev,
        )
      ).data;
    expect(
      (await releaseVersions()).find((v: any) => v.id === vid).published,
    ).toBe(false);
    expect((await publish(a.id, vid)).status).toBe(200);
    expect(
      (await releaseVersions()).find((v: any) => v.id === vid).published,
    ).toBe(true);
    expect((await call("/catalog/workflow-mini")).status).toBe(200);
    const s = (await call("/sessions", "POST", { appId: a.id }, guest)).data;
    const token = s.payload + "." + s.signature;
    const bytes = await call(
      "/sessions/" + s.sessionId + "/bundle",
      "GET",
      undefined,
      "",
      token,
    );
    expect(bytes.status).toBe(200);
    expect(sha(bytes.data)).toBe(s.bundleHash);
    const event = {
      id: randomUUID(),
      name: "round_completed",
      props: { scoreBucket: "medium" },
    };
    expect(
      (await call("/events/batch", "POST", { events: [event] }, "", token))
        .status,
    ).toBe(200);
    await call("/events/batch", "POST", { events: [event] }, "", token);
    expect(
      (
        await call(
          "/apps/" + a.id + "/feedback",
          "POST",
          { rating: "up", body: "Useful! email me at person@example.com" },
          guest,
        )
      ).status,
    ).toBe(200);
    const analytics = (
      await call(
        "/developer/apps/" + a.id + "/analytics",
        "GET",
        undefined,
        dev,
      )
    ).data;
    expect(analytics.versions[0].starts).toBe(1);
    expect(analytics.versions[0].completions).toBe(1);
    expect(
      (
        await call(
          "/developer/apps/" + a.id + "/feedback",
          "GET",
          undefined,
          dev,
        )
      ).data[0].body,
    ).toContain("[email removed]");
    const v2 = (await upload(a.id, "workflow-mini", "2.0.0")).data.id;
    await approve(a.id, v2);
    expect((await publish(a.id, v2)).status).toBe(200);
    expect(
      (await releaseVersions())
        .filter((v: any) => v.published)
        .map((v: any) => v.id),
    ).toEqual([v2]);
    expect(
      (
        await call(
          "/sessions/" + s.sessionId + "/status",
          "GET",
          undefined,
          "",
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (await call("/sessions", "POST", { appId: a.id }, guest)).data.versionId,
    ).toBe(v2);
    expect((await publish(a.id, vid)).status).toBe(200);
    expect(
      (await releaseVersions())
        .filter((v: any) => v.published)
        .map((v: any) => v.id),
    ).toEqual([vid]);
    expect(
      (await system.app.inject("/seed-preview/workflow-mini/index.html"))
        .statusCode,
    ).toBe(403);
    await call(
      "/apps/" + a.id + "/report",
      "POST",
      { category: "privacy", detail: "Please investigate" },
      guest,
    );
    expect(
      (await call("/admin/reports", "GET", undefined, admin)).data.some(
        (r: any) => r.app_id === a.id,
      ),
    ).toBe(true);
    expect(
      (
        await call(
          "/admin/apps/" + a.id + "/suspend",
          "POST",
          { reason: "Safety rehearsal takedown" },
          admin,
        )
      ).status,
    ).toBe(200);
    expect((await call("/catalog/workflow-mini")).status).toBe(404);
    expect(
      (
        await call(
          "/sessions/" + s.sessionId + "/status",
          "GET",
          undefined,
          "",
          token,
        )
      ).status,
    ).toBe(403);
    expect((await publish(a.id, vid)).status).toBe(409);
  });
  it("rejects rejected versions and duplicate uploads", async () => {
    const a = await create("rejected-mini");
    const v = (await upload(a.id, "rejected-mini")).data.id;
    expect((await upload(a.id, "rejected-mini")).status).toBe(409);
    await call(
      `/developer/apps/${a.id}/versions/${v}/submit-review`,
      "POST",
      {},
      dev,
    );
    expect(
      (
        await call(
          `/admin/reviews/${v}/decision`,
          "POST",
          { decision: "rejected", reason: "Needs changes before publication" },
          admin,
        )
      ).status,
    ).toBe(200);
    expect((await publish(a.id, v)).status).toBe(403);
    expect((await call("/catalog/rejected-mini")).status).toBe(404);
  });
  it("rejects forged, expired and wrong-session grants", async () => {
    const a = (await call("/catalog")).data.items[0];
    const s = (await call("/sessions", "POST", { appId: a.id }, guest)).data;
    expect(
      (
        await call(
          "/sessions/" + s.sessionId + "/bundle",
          "GET",
          undefined,
          "",
          s.payload + ".invalid",
        )
      ).status,
    ).toBe(401);
    const expired = system.keys.seal({ ...s, expiresAt: 0 });
    expect(
      (
        await call(
          "/sessions/" + s.sessionId + "/bundle",
          "GET",
          undefined,
          "",
          expired.payload + "." + expired.signature,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/sessions/wrong/status",
          "GET",
          undefined,
          "",
          s.payload + "." + s.signature,
        )
      ).status,
    ).toBe(403);
  });
  it("enforces immutable version records at database level", async () => {
    const v = (await system.db.query("SELECT id FROM versions LIMIT 1"))[0];
    await expect(
      system.db.query("UPDATE versions SET bundle_hash=$1 WHERE id=$2", [
        "altered",
        v.id,
      ]),
    ).rejects.toThrow("Immutable version");
  });
  it("detects corrupted stored bundle bytes", async () => {
    await system.store.put("0".repeat(64), new Uint8Array([1, 2, 3]));
    await expect(system.store.get("0".repeat(64))).rejects.toThrow("integrity");
  });
  it("saves, blocks, unblocks and deletes guest data", async () => {
    const g = (await call("/auth/guest", "POST", {})).cookie;
    const a = (await call("/catalog")).data.items[0];
    await call("/apps/" + a.id + "/save", "POST", {}, g);
    expect((await call("/saved", "GET", undefined, g)).data).toHaveLength(1);
    await call("/developers/" + a.developer_id + "/block", "POST", {}, g);
    expect(
      (await call("/catalog", "GET", undefined, g)).data.items,
    ).toHaveLength(0);
    expect((await call("/sessions", "POST", { appId: a.id }, g)).status).toBe(
      403,
    );
    await call("/developers/" + a.developer_id + "/block", "DELETE", {}, g);
    expect((await call("/saved", "GET", undefined, g)).data).toHaveLength(1);
    await call("/me", "DELETE", {}, g);
    expect((await call("/saved", "GET", undefined, g)).data).toHaveLength(0);
  });
  it("renews signed pinned sessions and denies ungranted analytics", async () => {
    const a = await create("renewal-mini");
    const manifest = {
      id: "renewal-mini",
      name: "Renewal Mini",
      description: "A session renewal fixture",
      version: "1.0.0",
      runtime: "webview-v1",
      entry: "index.html",
      category: "utility",
      estimatedDurationSeconds: 300,
      ageRating: "general",
      capabilities: [],
      network: { allowedDomains: [] },
      assets: {},
    };
    const zip = makeZip({
      "manifest.json": JSON.stringify(manifest),
      "index.html": "<!doctype html><title>Renewal</title><h1>Ready</h1>",
    });
    const v = (
      await call(
        "/developer/apps/" + a.id + "/upload",
        "POST",
        { zipBase64: Buffer.from(zip).toString("base64") },
        dev,
      )
    ).data.id;
    expect(
      (
        await call(
          "/sessions",
          "POST",
          { appId: a.id, versionId: v, preview: true },
          admin,
        )
      ).status,
    ).toBe(200);
    await approve(a.id, v);
    await publish(a.id, v);
    const s = (await call("/sessions", "POST", { appId: a.id }, guest)).data;
    const renewed = await call(
      "/sessions/" + s.sessionId + "/renew",
      "POST",
      {},
      "",
      s.payload + "." + s.signature,
    );
    expect(renewed.status).toBe(200);
    expect(
      system.keys.verify(renewed.data.payload, renewed.data.signature),
    ).toBe(true);
    expect(renewed.data.versionId).toBe(v);
    expect(renewed.data.capabilities).toEqual([]);
    expect(
      (
        await call(
          "/events/batch",
          "POST",
          {
            events: [
              {
                id: randomUUID(),
                name: "task_completed",
                props: { completed: true },
              },
            ],
          },
          "",
          s.payload + "." + s.signature,
        )
      ).status,
    ).toBe(403);
    await call(
      "/admin/versions/" + v + "/disable",
      "POST",
      { reason: "Disabled during security test" },
      admin,
    );
    expect(
      (
        await call(
          "/sessions/" + s.sessionId + "/renew",
          "POST",
          {},
          "",
          renewed.data.payload + "." + renewed.data.signature,
        )
      ).status,
    ).toBe(403);
    expect((await publish(a.id, v)).status).toBe(403);
  });
  it("returns complete recent metadata and migrates guest data on sign-in", async () => {
    const g = (await call("/auth/guest", "POST", {})).cookie;
    const a = (await call("/catalog")).data.items.find(
      (a: any) => a.slug === "color-clash",
    );
    await call("/apps/" + a.id + "/save", "POST", {}, g);
    await call("/sessions", "POST", { appId: a.id }, g);
    const history = (await call("/history", "GET", undefined, g)).data;
    expect(history[0].creator).toBe("FirstTry Studio");
    expect(history[0].manifest.runtime).toBe("webview-v1");
    const account = await call(
      "/auth/login",
      "POST",
      { email: "consumer@firsttry.local", password: localPassword },
      g,
    );
    expect(account.status).toBe(200);
    expect(
      (await call("/saved", "GET", undefined, account.cookie)).data,
    ).toHaveLength(1);
    expect(
      (await call("/history", "GET", undefined, account.cookie)).data,
    ).toHaveLength(1);
    await call("/me", "DELETE", {}, account.cookie);
  });
  it("bounds analytics at 100 unique events while permitting exact retries", async () => {
    const a = (await call("/catalog")).data.items.find(
      (a: any) => a.slug === "color-clash",
    );
    const grant = (await call("/sessions", "POST", { appId: a.id }, guest))
      .data;
    const token = grant.payload + "." + grant.signature;
    let first: any;
    for (let i = 0; i < 5; i++) {
      const events = Array.from({ length: 20 }, () => ({
        id: randomUUID(),
        name: "round_completed",
        props: { scoreBucket: "medium" },
      }));
      first ??= events[0];
      expect(
        (await call("/events/batch", "POST", { events }, "", token)).status,
      ).toBe(200);
    }
    expect(
      (await call("/events/batch", "POST", { events: [first] }, "", token))
        .status,
    ).toBe(200);
    expect(
      (
        await call(
          "/events/batch",
          "POST",
          { events: [{ ...first, id: randomUUID() }] },
          "",
          token,
        )
      ).status,
    ).toBe(429);
  });
});

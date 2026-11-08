import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../src/app.js";
import { makeZip } from "../src/bundles.js";
import { localPassword } from "../src/seeds.js";

let system: Awaited<ReturnType<typeof createApp>>,
  dev = "",
  other = "",
  consumer = "";

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
const login = async (email: string) =>
  (await call("/auth/login", "POST", { email, password: localPassword }))
    .cookie;
const zipFor = (slug: string) =>
  Buffer.from(
    makeZip({
      "manifest.json": JSON.stringify({
        id: slug,
        name: "Token Mini",
        description: "Deployed with a token",
        version: "1.0.0",
        runtime: "webview-v1",
        entry: "index.html",
        category: "games",
        estimatedDurationSeconds: 30,
        ageRating: "general",
        capabilities: [],
        network: { allowedDomains: [] },
        assets: {},
      }),
      "index.html": '<!doctype html><title>T</title><script src="a.js"></script>',
      "a.js": 'document.body.textContent="ok";',
    }),
  ).toString("base64");

async function deviceLogin(approveWith = dev) {
  const start = (await call("/auth/device", "POST", {})).data;
  expect(start.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const pending = await call("/auth/device/token", "POST", {
    deviceCode: start.deviceCode,
  });
  expect(pending.status).toBe(428);
  expect(pending.data.error).toBe("authorization_pending");
  expect(
    (
      await call(
        "/auth/device/approve",
        "POST",
        { userCode: start.userCode.toLowerCase().replace("-", " ") },
        approveWith,
      )
    ).status,
  ).toBe(200);
  return { start, token: await call("/auth/device/token", "POST", { deviceCode: start.deviceCode }) };
}

beforeAll(async () => {
  system = await createApp({ memory: true });
  dev = await login("developer@firsttry.local");
  other = await login("other@firsttry.local");
  consumer = await login("consumer@firsttry.local");
});
afterAll(async () => system.app.close());

describe("device-code login", () => {
  it("issues a cli token only after a developer approves the code", async () => {
    const { token } = await deviceLogin();
    expect(token.status).toBe(200);
    expect(token.data.token).toMatch(/^ft_/);
    const me = await call("/me", "GET", undefined, "", token.data.token);
    expect(me.status).toBe(200);
    expect(me.data.role).toBe("developer");
    expect(
      (await call("/developer/apps", "GET", undefined, "", token.data.token))
        .status,
    ).toBe(200);
  });

  it("is single use", async () => {
    const { start } = await deviceLogin();
    const again = await call("/auth/device/token", "POST", {
      deviceCode: start.deviceCode,
    });
    expect(again.status).toBe(400);
  });

  it("rejects unknown codes and non-developers", async () => {
    expect(
      (await call("/auth/device/approve", "POST", { userCode: "ZZZZ-ZZZZ" }, dev))
        .status,
    ).toBe(404);
    const start = (await call("/auth/device", "POST", {})).data;
    expect(
      (
        await call(
          "/auth/device/approve",
          "POST",
          { userCode: start.userCode },
          consumer,
        )
      ).status,
    ).toBe(403);
    expect(
      (await call("/auth/device/approve", "POST", { userCode: start.userCode }))
        .status,
    ).toBe(401);
    expect(
      (
        await call("/auth/device/token", "POST", {
          deviceCode: "x".repeat(40),
        })
      ).status,
    ).toBe(400);
  });
});

describe("deploy tokens", () => {
  let cli = "",
    deploy = "";
  beforeAll(async () => {
    cli = (await deviceLogin()).token.data.token;
    const made = await call(
      "/developer/tokens",
      "POST",
      { name: "github-actions", expiresInDays: 30 },
      "",
      cli,
    );
    expect(made.status).toBe(200);
    expect(made.data.scope).toBe("deploy");
    deploy = made.data.token;
  });

  it("can create an app, upload and submit, but not publish or mint tokens", async () => {
    const app = (
      await call(
        "/developer/apps",
        "POST",
        {
          slug: "token-mini",
          title: "Token Mini",
          summary: "Deployed with a token",
          category: "games",
        },
        "",
        deploy,
      )
    ).data;
    expect(app.id).toBeTruthy();
    const up = await call(
      `/developer/apps/${app.id}/upload`,
      "POST",
      { zipBase64: zipFor("token-mini") },
      "",
      deploy,
    );
    expect(up.status).toBe(200);
    expect(
      (
        await call(
          `/developer/apps/${app.id}/versions/${up.data.id}/submit-review`,
          "POST",
          {},
          "",
          deploy,
        )
      ).status,
    ).toBe(200);
    for (const [url, method, body] of [
      [`/developer/apps/${app.id}/release`, "POST", { versionId: up.data.id }],
      [`/developer/apps/${app.id}/pause`, "POST", {}],
      [`/developer/apps/${app.id}/analytics`, "GET", undefined],
      ["/developer/tokens", "POST", { name: "escalate" }],
      ["/developer/tokens", "GET", undefined],
    ] as const)
      expect(
        (await call(url, method, body, "", deploy)).status,
        `${method} ${url}`,
      ).toBe(401);
  });

  it("cannot act on another developer's app", async () => {
    const mine = (
      await call(
        "/developer/apps",
        "POST",
        {
          slug: "someone-elses",
          title: "Not yours",
          summary: "Owned by other",
          category: "games",
        },
        other,
      )
    ).data;
    expect(
      (
        await call(
          `/developer/apps/${mine.id}/upload`,
          "POST",
          { zipBase64: zipFor("someone-elses") },
          "",
          deploy,
        )
      ).status,
    ).toBe(404);
  });

  it("is rejected on cookie-only routes and when invalid", async () => {
    expect(
      (await call("/admin/reviews", "GET", undefined, "", deploy)).status,
    ).toBe(401);
    expect(
      (await call("/auth/device/approve", "POST", { userCode: "AAAA-AAAA" }, "", deploy))
        .status,
    ).toBe(401);
    expect(
      (await call("/developer/apps", "GET", undefined, "", "ft_bogus")).status,
    ).toBe(401);
    // A bad bearer must not fall back to a valid session cookie.
    expect(
      (await call("/developer/apps", "GET", undefined, dev, "ft_bogus")).status,
    ).toBe(401);
  });

  it("can be listed, revoked and stops working", async () => {
    const listed = await call("/developer/tokens", "GET", undefined, dev);
    const row = listed.data.find((t: any) => t.name === "github-actions");
    expect(row).toBeTruthy();
    expect(JSON.stringify(listed.data)).not.toContain(deploy);
    expect(
      (await call("/developer/tokens/" + row.id, "DELETE", undefined, other))
        .status,
    ).toBe(404);
    expect(
      (await call("/developer/tokens/" + row.id, "DELETE", undefined, dev))
        .status,
    ).toBe(200);
    expect(
      (await call("/developer/apps", "GET", undefined, "", deploy)).status,
    ).toBe(401);
  });

  it("revokes itself on logout", async () => {
    const t = (await deviceLogin()).token.data.token;
    expect(
      (await call("/developer/tokens/current", "DELETE", undefined, "", t))
        .status,
    ).toBe(200);
    expect((await call("/me", "GET", undefined, "", t)).status).toBe(401);
  });
});

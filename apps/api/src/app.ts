import Fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  listingSchema,
  feedbackSchema,
  reportSchema,
  eventSchema,
  canTransition,
} from "@firsttry/shared";
import { Database, type Row } from "./db.js";
import {
  BundleStore,
  validateBundle,
  sha,
  checkPassword,
  signingKeys,
  CSP,
} from "./bundles.js";
import { seed } from "./seeds.js";
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const redact = (s: string) =>
  s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/\b(?:\+?\d[\d ()-]{7,}\d)\b/g, "[number removed]");
export async function createApp(
  options: { memory?: boolean; seed?: boolean } = {},
) {
  const app = Fastify({ logger: false, bodyLimit: 3 * 1024 * 1024 });
  const db = await Database.open(options.memory);
  const store = new BundleStore(undefined, options.memory);
  const keys = await signingKeys(options.memory);
  if (options.seed !== false) await seed(db, store);
  await app.register(cookie);
  await app.register(rateLimit, {
    max: options.memory ? 10000 : 180,
    timeWindow: "1 minute",
  });
  const routes: { path: string; method: string }[] = [];
  app.addHook("onRoute", (route) => {
    for (const method of Array.isArray(route.method)
      ? route.method
      : [route.method])
      if (route.url.startsWith("/api/v1/") && method !== "HEAD")
        routes.push({
          path: route.url.replace(/:([A-Za-z]+)/g, "{$1}"),
          method: method.toLowerCase(),
        });
  });
  const now = () => Math.floor(Date.now() / 1000);
  async function user(req: FastifyRequest, role?: string) {
    const token = req.cookies.ft_session;
    const rows = token
      ? await db.query(
          "SELECT u.* FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.active=true",
          [sha(token), now()],
        )
      : [];
    const u = rows[0];
    if (!u) fail(401, "Sign in required");
    if (role && u.role !== role) fail(403, "Role not permitted");
    return u;
  }
  async function subject(req: FastifyRequest) {
    if (req.cookies.ft_session) {
      try {
        return "user:" + (await user(req)).id;
      } catch {}
    }
    const guest = req.cookies.ft_guest;
    if (!guest || !z.uuid().safeParse(guest).success)
      fail(401, "Start a guest session first");
    return "guest:" + guest;
  }
  async function own(req: FastifyRequest, id: string) {
    const u = await user(req, "developer");
    const rows = await db.query(
      "SELECT * FROM apps WHERE id=$1 AND developer_id=$2",
      [id, u.id],
    );
    if (!rows[0]) fail(404, "App not found");
    return { u, a: rows[0] };
  }
  async function audit(
    actor: string,
    action: string,
    appId: string | null = null,
    versionId: string | null = null,
    reason = "",
  ) {
    await db.query(
      "INSERT INTO audit(id,actor,action,app_id,version_id,reason) VALUES($1,$2,$3,$4,$5,$6)",
      [randomUUID(), actor, action, appId, versionId, reason],
    );
  }
  const id = (req: FastifyRequest, key = "id") =>
    String((req.params as Row)[key]);
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers["x-firsttry-request"] !== "1")
        fail(403, "Request header required");
      const origin = req.headers.origin;
      if (
        origin &&
        ![
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          process.env.WEB_ORIGIN,
        ].includes(origin)
      )
        fail(403, "Origin not permitted");
    }
  });
  app.setErrorHandler((error: any, _req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        error: "Validation failed",
        details: error.issues.map(
          (i: any) => i.path.join(".") + ": " + i.message,
        ),
      });
    if (error.code === "23505")
      return reply
        .code(409)
        .send({ error: "This identifier or version already exists" });
    const status =
      error.statusCode ?? (/^[A-Z0-9]{5}$/.test(error.code ?? "") ? 500 : 400);
    reply
      .code(status)
      .send({ error: status >= 500 ? "Internal server error" : error.message });
  });
  app.addHook("onClose", async () => db.close());
  app.get("/api/v1/health", async () => ({
    status: "ok",
    mode: "local-development",
    database: process.env.DATABASE_URL ? "postgresql" : "embedded-postgresql",
  }));
  app.post("/api/v1/auth/guest", async (req, reply) => {
    const guest = z.uuid().safeParse(req.cookies.ft_guest).success
      ? req.cookies.ft_guest!
      : randomUUID();
    reply.setCookie("ft_guest", guest, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 86400 * 30,
    });
    return { guest: true };
  });
  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(req.body);
      const rows = await db.query(
        "SELECT * FROM users WHERE email=$1 AND active=true",
        [body.email.toLowerCase()],
      );
      if (!rows[0] || !checkPassword(body.password, rows[0].password_hash))
        fail(401, "Invalid credentials");
      if (
        req.cookies.ft_guest &&
        z.uuid().safeParse(req.cookies.ft_guest).success
      ) {
        const from = "guest:" + req.cookies.ft_guest,
          to = "user:" + rows[0].id;
        await db.transaction(async (tx) => {
          for (const table of ["saves", "blocks"]) {
            const key = table === "saves" ? "app_id" : "developer_id";
            await tx.query(
              `INSERT INTO ${table}(subject,${key}) SELECT $1,${key} FROM ${table} WHERE subject=$2 ON CONFLICT DO NOTHING`,
              [to, from],
            );
            await tx.query(`DELETE FROM ${table} WHERE subject=$1`, [from]);
          }
          for (const table of ["sessions", "feedback", "reports"])
            await tx.query(`UPDATE ${table} SET subject=$1 WHERE subject=$2`, [
              to,
              from,
            ]);
        });
      }
      const token = randomUUID() + randomUUID();
      await db.query("INSERT INTO auth_sessions VALUES($1,$2,$3)", [
        sha(token),
        rows[0].id,
        now() + 86400,
      ]);
      reply.setCookie("ft_session", token, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      });
      return { id: rows[0].id, name: rows[0].name, role: rows[0].role };
    },
  );
  app.post("/api/v1/auth/logout", async (req, reply) => {
    if (req.cookies.ft_session)
      await db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
        sha(req.cookies.ft_session),
      ]);
    reply.clearCookie("ft_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/v1/me", async (req) => {
    const u = await user(req);
    return { id: u.id, name: u.name, role: u.role };
  });
  const catalogSql = `SELECT a.*,u.name creator,v.id version_id,v.semver,v.manifest FROM apps a JOIN users u ON u.id=a.developer_id JOIN releases r ON r.app_id=a.id JOIN versions v ON v.id=r.version_id WHERE a.status='active' AND u.active=true AND v.review_status='approved'`;
  app.get("/api/v1/catalog", async (req) => {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        category: z.string().optional(),
        sort: z.enum(["new", "featured"]).optional(),
        cursor: z.coerce.number().int().min(0).max(100000).default(0),
      })
      .parse(req.query);
    let who = "";
    try {
      who = await subject(req);
    } catch {}
    const rows = await db.query(
      catalogSql +
        ` AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.subject=$1 AND b.developer_id=a.developer_id) AND ($2='' OR a.category=$2) AND (a.title ILIKE $3 OR a.summary ILIKE $3) ORDER BY a.featured DESC,a.created_at DESC,a.id LIMIT 21 OFFSET $4`,
      [who, q.category ?? "", "%" + (q.q ?? "") + "%", q.cursor],
    );
    return {
      items: rows.slice(0, 20),
      nextCursor: rows.length > 20 ? q.cursor + 20 : null,
    };
  });
  app.get("/api/v1/catalog/:slug", async (req) => {
    let who = "";
    try {
      who = await subject(req);
    } catch {}
    const rows = await db.query(
      catalogSql +
        " AND a.slug=$1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.subject=$2 AND b.developer_id=a.developer_id)",
      [id(req, "slug"), who],
    );
    return rows[0] ?? fail(404, "This experience is unavailable");
  });
  app.get("/api/v1/saved", async (req) =>
    db.query(
      catalogSql +
        " AND a.id IN(SELECT app_id FROM saves WHERE subject=$1) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.subject=$1 AND b.developer_id=a.developer_id)",
      [await subject(req)],
    ),
  );
  app.post("/api/v1/apps/:id/save", async (req) => {
    const who = await subject(req);
    if (!(await db.query(catalogSql + " AND a.id=$1", [id(req)]))[0])
      fail(404, "App unavailable");
    await db.query("INSERT INTO saves VALUES($1,$2) ON CONFLICT DO NOTHING", [
      who,
      id(req),
    ]);
    return { saved: true };
  });
  app.delete("/api/v1/apps/:id/save", async (req) => {
    await db.query("DELETE FROM saves WHERE subject=$1 AND app_id=$2", [
      await subject(req),
      id(req),
    ]);
    return { saved: false };
  });
  app.post("/api/v1/developers/:id/block", async (req) => {
    if (
      !(
        await db.query(
          "SELECT id FROM users WHERE id=$1 AND role='developer'",
          [id(req)],
        )
      )[0]
    )
      fail(404, "Creator not found");
    await db.query("INSERT INTO blocks VALUES($1,$2) ON CONFLICT DO NOTHING", [
      await subject(req),
      id(req),
    ]);
    return { blocked: true };
  });
  app.delete("/api/v1/developers/:id/block", async (req) => {
    await db.query("DELETE FROM blocks WHERE subject=$1 AND developer_id=$2", [
      await subject(req),
      id(req),
    ]);
    return { blocked: false };
  });
  app.get("/api/v1/blocks", async (req) =>
    db.query(
      "SELECT u.id,u.name FROM blocks b JOIN users u ON u.id=b.developer_id WHERE b.subject=$1",
      [await subject(req)],
    ),
  );
  app.post("/api/v1/apps/:id/feedback", async (req) => {
    const who = await subject(req);
    const body = feedbackSchema.parse(req.body);
    const sessions = await db.query(
      "SELECT * FROM sessions WHERE subject=$1 AND app_id=$2 ORDER BY created_at DESC LIMIT 1",
      [who, id(req)],
    );
    if (!sessions[0]) fail(403, "Try the app before leaving feedback");
    const recent = await db.query(
      "SELECT id FROM feedback WHERE subject=$1 AND app_id=$2 AND created_at>now()-interval '1 minute'",
      [who, id(req)],
    );
    if (recent.length) fail(429, "Please wait before submitting more feedback");
    await db.query(
      "INSERT INTO feedback(id,subject,app_id,version_id,rating,body) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        who,
        id(req),
        sessions[0].version_id,
        body.rating,
        redact(body.body),
      ],
    );
    return { ok: true };
  });
  app.post("/api/v1/apps/:id/report", async (req) => {
    const body = reportSchema.parse(req.body);
    if (!(await db.query("SELECT id FROM apps WHERE id=$1", [id(req)]))[0])
      fail(404, "App unavailable");
    await db.query(
      "INSERT INTO reports(id,subject,app_id,category,detail) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        await subject(req),
        id(req),
        body.category,
        redact(body.detail),
      ],
    );
    return { ok: true };
  });
  app.get("/api/v1/my-reports", async (req) =>
    db.query(
      "SELECT r.id,r.category,r.status,r.created_at,a.title FROM reports r JOIN apps a ON a.id=r.app_id WHERE r.subject=$1 ORDER BY r.created_at DESC",
      [await subject(req)],
    ),
  );
  app.get("/api/v1/history", async (req) =>
    db.query(
      "SELECT * FROM (SELECT DISTINCT ON(a.id) a.*,u.name creator,v.id version_id,v.semver,v.manifest,s.created_at last_used FROM sessions s JOIN apps a ON a.id=s.app_id JOIN users u ON u.id=a.developer_id JOIN releases r ON r.app_id=a.id JOIN versions v ON v.id=r.version_id WHERE s.subject=$1 AND s.preview=false AND a.status='active' AND u.active=true AND v.review_status='approved' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.subject=$1 AND b.developer_id=a.developer_id) ORDER BY a.id,s.created_at DESC) history ORDER BY last_used DESC",
      [await subject(req)],
    ),
  );
  app.post("/api/v1/sessions", async (req) => {
    const who = await subject(req);
    const body = z
      .object({
        appId: z.string(),
        versionId: z.string().optional(),
        preview: z.boolean().default(false),
      })
      .parse(req.body);
    let rows: Row[];
    if (body.preview) {
      const reviewer = await user(req);
      if (reviewer.role !== "admin") await own(req, body.appId);
      rows = await db.query(
        "SELECT a.*,v.id version_id,v.bundle_hash,v.files,v.manifest,v.review_status FROM apps a JOIN versions v ON v.app_id=a.id JOIN users u ON u.id=a.developer_id WHERE a.id=$1 AND v.id=$2 AND a.status='active' AND u.active=true",
        [body.appId, body.versionId],
      );
    } else
      rows = await db.query(
        catalogSql +
          ` AND a.id=$1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.subject=$2 AND b.developer_id=a.developer_id)`,
        [body.appId, who],
      );
    const row = rows[0];
    if (!row) fail(403, "No authorized release");
    const version = await db.query("SELECT * FROM versions WHERE id=$1", [
      row.version_id,
    ]);
    const v = version[0];
    const sid = randomUUID(),
      expiresAt = now() + 120;
    await db.query(
      "INSERT INTO sessions(id,app_id,version_id,subject,expires_at,preview) VALUES($1,$2,$3,$4,$5,$6)",
      [sid, body.appId, v.id, who, expiresAt, body.preview],
    );
    const payload = {
      sessionId: sid,
      appId: body.appId,
      versionId: v.id,
      bundleHash: v.bundle_hash,
      files: v.files,
      origin: `https://app-${body.appId}.mini.firsttry.invalid`,
      entry: "index.html",
      expiresAt,
      keyId: keys.keyId,
      preview: body.preview,
      capabilities: v.manifest.capabilities,
    };
    return {
      ...keys.seal(payload),
      ...payload,
      bundlePath: `/api/v1/sessions/${sid}/bundle`,
      publicKey: keys.publicKey,
    };
  });
  async function authorized(req: FastifyRequest) {
    const encoded = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const [payload, signature] = encoded.split(".");
    if (!payload || !signature || !keys.verify(payload, signature))
      fail(401, "Invalid session signature");
    let grant: Row;
    try {
      grant = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      fail(401, "Invalid session");
    }
    if (grant!.expiresAt <= now()) fail(401, "Session authorization expired");
    const rows = await db.query(
      "SELECT s.*,a.status,u.active,v.review_status,v.bundle_hash FROM sessions s JOIN apps a ON a.id=s.app_id JOIN users u ON u.id=a.developer_id JOIN versions v ON v.id=s.version_id WHERE s.id=$1",
      [grant!.sessionId],
    );
    const s = rows[0];
    if (
      !s ||
      s.ended_at ||
      s.status !== "active" ||
      !s.active ||
      (!s.preview && s.review_status !== "approved") ||
      s.version_id !== grant!.versionId ||
      s.app_id !== grant!.appId ||
      s.expires_at <= now()
    )
      fail(403, "Session revoked");
    return s;
  }
  app.post("/api/v1/sessions/:id/renew", async (req) => {
    const s = await authorized(req);
    if (s.id !== id(req)) fail(403, "Wrong session");
    const v = (
      await db.query("SELECT * FROM versions WHERE id=$1", [s.version_id])
    )[0];
    const expiresAt = now() + 120;
    await db.query("UPDATE sessions SET expires_at=$1 WHERE id=$2", [
      expiresAt,
      s.id,
    ]);
    const grant = {
      sessionId: s.id,
      appId: s.app_id,
      versionId: s.version_id,
      bundleHash: v.bundle_hash,
      files: v.files,
      origin: `https://app-${s.app_id}.mini.firsttry.invalid`,
      entry: "index.html",
      expiresAt,
      keyId: keys.keyId,
      preview: s.preview,
      capabilities: v.manifest.capabilities,
    };
    return { ...keys.seal(grant), ...grant };
  });
  app.get("/api/v1/sessions/:id/status", async (req) => {
    const s = await authorized(req);
    if (s.id !== id(req)) fail(403, "Wrong session");
    return { active: true, expiresAt: s.expires_at };
  });
  app.get("/api/v1/sessions/:id/bundle", async (req, reply) => {
    const s = await authorized(req);
    if (s.id !== id(req)) fail(403, "Wrong session");
    return reply
      .type("application/zip")
      .send(Buffer.from(await store.get(s.bundle_hash)));
  });
  app.post("/api/v1/sessions/:id/end", async (req) => {
    const s = await authorized(req);
    if (s.id !== id(req)) fail(403, "Wrong session");
    await db.query("UPDATE sessions SET ended_at=now() WHERE id=$1", [s.id]);
    return { ok: true };
  });
  app.post("/api/v1/events/batch", async (req) => {
    const s = await authorized(req);
    const version = (
      await db.query("SELECT manifest FROM versions WHERE id=$1", [
        s.version_id,
      ])
    )[0];
    if (!version.manifest.capabilities.includes("host.analytics"))
      fail(403, "Analytics capability not granted");
    const body = z
      .object({ events: z.array(eventSchema).min(1).max(20) })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await tx.query("SELECT id FROM sessions WHERE id=$1 FOR UPDATE", [s.id]);
      const total = (
        await tx.query(
          "SELECT count(*)::int count FROM events WHERE session_id=$1",
          [s.id],
        )
      )[0].count;
      const incoming = [...new Set(body.events.map((e) => e.id))];
      const existing = (
        await tx.query(
          "SELECT id FROM events WHERE session_id=$1 AND id IN(" +
            incoming.map((_, i) => "$" + (i + 2)).join(",") +
            ")",
          [s.id, ...incoming],
        )
      ).length;
      if (total + incoming.length - existing > 100)
        fail(429, "Session event limit exceeded");
      const values: unknown[] = [];
      const tuples = body.events.map((event, i) => {
        values.push(event.id, s.id, event.name, JSON.stringify(event.props));
        return `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`;
      });
      await tx.query(
        "INSERT INTO events(id,session_id,name,props) VALUES " +
          tuples.join(",") +
          " ON CONFLICT(id) DO NOTHING",
        values,
      );
    });
    return { accepted: body.events.length };
  });
  app.delete("/api/v1/me/app-data/:id", async (req) => {
    const who = await subject(req);
    await db.transaction(async (tx) => {
      await tx.query(
        "DELETE FROM events WHERE session_id IN(SELECT id FROM sessions WHERE subject=$1 AND app_id=$2)",
        [who, id(req)],
      );
      await tx.query("DELETE FROM sessions WHERE subject=$1 AND app_id=$2", [
        who,
        id(req),
      ]);
      await tx.query("DELETE FROM saves WHERE subject=$1 AND app_id=$2", [
        who,
        id(req),
      ]);
      await tx.query("DELETE FROM feedback WHERE subject=$1 AND app_id=$2", [
        who,
        id(req),
      ]);
    });
    return { ok: true };
  });
  app.delete("/api/v1/me", async (req, reply) => {
    const who = await subject(req);
    await db.transaction(async (tx) => {
      await tx.query(
        "DELETE FROM events WHERE session_id IN(SELECT id FROM sessions WHERE subject=$1)",
        [who],
      );
      await tx.query("DELETE FROM sessions WHERE subject=$1", [who]);
      for (const table of ["saves", "blocks", "feedback"])
        await tx.query(`DELETE FROM ${table} WHERE subject=$1`, [who]);
      await tx.query(
        "UPDATE reports SET subject='deleted',detail='' WHERE subject=$1",
        [who],
      );
      if (who.startsWith("user:")) {
        const uid = who.slice(5);
        if (
          (await tx.query("SELECT id FROM apps WHERE developer_id=$1", [uid]))
            .length
        )
          fail(
            409,
            "Archive developer apps with support before account deletion",
          );
        await tx.query("DELETE FROM auth_sessions WHERE user_id=$1", [uid]);
        await tx.query("DELETE FROM users WHERE id=$1", [uid]);
      }
    });
    reply
      .clearCookie("ft_session", { path: "/" })
      .clearCookie("ft_guest", { path: "/" });
    return { ok: true };
  });
  app.get("/api/v1/developer/apps", async (req) =>
    db.query(
      "SELECT a.*,(SELECT count(*) FROM versions v WHERE v.app_id=a.id) version_count FROM apps a WHERE developer_id=$1 ORDER BY created_at DESC",
      [(await user(req, "developer")).id],
    ),
  );
  app.post("/api/v1/developer/apps", async (req) => {
    const u = await user(req, "developer");
    const body = listingSchema.parse(req.body);
    const aid = randomUUID();
    await db.query(
      "INSERT INTO apps(id,developer_id,slug,title,summary,category) VALUES($1,$2,$3,$4,$5,$6)",
      [aid, u.id, body.slug, body.title, body.summary, body.category],
    );
    await audit(u.id, "create", aid);
    return { id: aid, ...body };
  });
  app.get("/api/v1/developer/apps/:id/versions", async (req) => {
    await own(req, id(req));
    return db.query(
      "SELECT v.id,v.semver,v.bundle_hash,v.manifest,v.review_status,v.review_reason,v.created_at,EXISTS(SELECT 1 FROM releases r WHERE r.app_id=v.app_id AND r.version_id=v.id) AS published FROM versions v WHERE v.app_id=$1 ORDER BY v.created_at DESC",
      [id(req)],
    );
  });
  app.post("/api/v1/developer/apps/:id/upload", async (req) => {
    const { u, a } = await own(req, id(req));
    const body = z
      .object({ zipBase64: z.string().max(2800000) })
      .parse(req.body);
    let bundle;
    try {
      bundle = validateBundle(Buffer.from(body.zipBase64, "base64"));
    } catch (e: any) {
      fail(400, e.message);
    }
    if (bundle!.manifest.id !== a.slug)
      fail(400, "Manifest id must match app slug");
    await store.put(bundle!.hash, Buffer.from(body.zipBase64, "base64"));
    const vid = randomUUID();
    await db.query(
      "INSERT INTO versions(id,app_id,semver,bundle_hash,manifest,files) VALUES($1,$2,$3,$4,$5,$6)",
      [
        vid,
        a.id,
        bundle!.manifest.version,
        bundle!.hash,
        JSON.stringify(bundle!.manifest),
        JSON.stringify(bundle!.inventory),
      ],
    );
    await audit(u.id, "upload-validated", a.id, vid);
    return { id: vid, status: "validated", hash: bundle!.hash };
  });
  app.post(
    "/api/v1/developer/apps/:id/versions/:vid/submit-review",
    async (req) => {
      const { u } = await own(req, id(req));
      const rows = await db.query(
        "UPDATE versions SET review_status=$1 WHERE id=$2 AND app_id=$3 AND review_status=$4 RETURNING id",
        ["pending", id(req, "vid"), id(req), "validated"],
      );
      if (!rows[0])
        fail(409, "Version cannot be submitted in its current state");
      await audit(u.id, "submit-review", id(req), id(req, "vid"));
      return { status: "pending" };
    },
  );
  app.post("/api/v1/developer/apps/:id/release", async (req) => {
    const { u } = await own(req, id(req));
    const body = z.object({ versionId: z.string() }).parse(req.body);
    await db.transaction(async (tx) => {
      const apps = await tx.query(
        "SELECT id FROM apps WHERE id=$1 AND status='active' FOR UPDATE",
        [id(req)],
      );
      if (!apps[0]) fail(409, "Suspended apps cannot publish");
      const v = await tx.query(
        "SELECT id FROM versions WHERE id=$1 AND app_id=$2 AND review_status='approved' FOR UPDATE",
        [body.versionId, id(req)],
      );
      if (!v[0]) fail(403, "Only approved versions can be released");
      await tx.query(
        "INSERT INTO releases(app_id,version_id) VALUES($1,$2) ON CONFLICT(app_id) DO UPDATE SET version_id=excluded.version_id,published_at=now()",
        [id(req), body.versionId],
      );
      await tx.query(
        "INSERT INTO audit(id,actor,action,app_id,version_id) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), u.id, "publish", id(req), body.versionId],
      );
    });
    return { published: true };
  });
  app.post("/api/v1/developer/apps/:id/pause", async (req) => {
    const { u } = await own(req, id(req));
    await db.query("DELETE FROM releases WHERE app_id=$1", [id(req)]);
    await db.query("UPDATE sessions SET expires_at=0 WHERE app_id=$1", [
      id(req),
    ]);
    await audit(u.id, "pause", id(req));
    return { paused: true };
  });
  app.get("/api/v1/developer/apps/:id/analytics", async (req) => {
    await own(req, id(req));
    return {
      versions: await db.query(
        "SELECT v.id,v.semver,count(DISTINCT s.id)::int starts,count(DISTINCT s.subject)::int users,count(DISTINCT e.id) FILTER(WHERE e.name IN('round_completed','task_completed'))::int completions FROM versions v LEFT JOIN sessions s ON s.version_id=v.id AND s.preview=false LEFT JOIN events e ON e.session_id=s.id WHERE v.app_id=$1 GROUP BY v.id,v.semver ORDER BY v.semver",
        [id(req)],
      ),
      feedback: await db.query(
        "SELECT rating,count(*)::int count FROM feedback WHERE app_id=$1 GROUP BY rating",
        [id(req)],
      ),
    };
  });
  app.get("/api/v1/developer/apps/:id/feedback", async (req) => {
    await own(req, id(req));
    return db.query(
      "SELECT rating,body,version_id,created_at FROM feedback WHERE app_id=$1 ORDER BY created_at DESC LIMIT 100",
      [id(req)],
    );
  });
  app.get("/api/v1/admin/reviews", async (req) => {
    await user(req, "admin");
    return db.query(
      "SELECT v.id,v.app_id,v.semver,v.review_status,v.review_reason,v.manifest,a.title,u.name creator FROM versions v JOIN apps a ON a.id=v.app_id JOIN users u ON u.id=a.developer_id WHERE v.review_status IN('pending','rejected') ORDER BY v.created_at DESC",
    );
  });
  app.post("/api/v1/admin/reviews/:id/decision", async (req) => {
    const u = await user(req, "admin");
    const body = z
      .object({
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().min(5).max(500),
      })
      .parse(req.body);
    await db.transaction(async (tx) => {
      const rows = await tx.query(
        "UPDATE versions SET review_status=$1,review_reason=$2 WHERE id=$3 AND review_status=$4 RETURNING app_id",
        [body.decision, body.reason, id(req), "pending"],
      );
      if (!rows[0]) fail(409, "Only pending versions can be reviewed");
      await tx.query(
        "INSERT INTO audit(id,actor,action,app_id,version_id,reason) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          u.id,
          body.decision,
          rows[0].app_id,
          id(req),
          body.reason,
        ],
      );
    });
    return { status: body.decision };
  });
  app.get("/api/v1/admin/apps", async (req) => {
    await user(req, "admin");
    return db.query(
      "SELECT a.*,v.semver FROM apps a LEFT JOIN releases r ON r.app_id=a.id LEFT JOIN versions v ON v.id=r.version_id ORDER BY a.created_at DESC",
    );
  });
  app.post("/api/v1/admin/apps/:id/suspend", async (req) => {
    const u = await user(req, "admin");
    const reason = z
      .object({ reason: z.string().min(5).max(500) })
      .parse(req.body).reason;
    await db.transaction(async (tx) => {
      await tx.query("UPDATE apps SET status='suspended' WHERE id=$1", [
        id(req),
      ]);
      await tx.query("UPDATE sessions SET expires_at=0 WHERE app_id=$1", [
        id(req),
      ]);
      await tx.query(
        "INSERT INTO audit(id,actor,action,app_id,reason) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), u.id, "suspend", id(req), reason],
      );
    });
    return { suspended: true };
  });
  app.post("/api/v1/admin/developers/:id/suspend", async (req) => {
    const u = await user(req, "admin");
    const reason = z
      .object({ reason: z.string().min(5).max(500) })
      .parse(req.body).reason;
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE users SET active=false WHERE id=$1 AND role='developer'",
        [id(req)],
      );
      await tx.query(
        "UPDATE sessions SET expires_at=0 WHERE app_id IN(SELECT id FROM apps WHERE developer_id=$1)",
        [id(req)],
      );
      await tx.query("DELETE FROM auth_sessions WHERE user_id=$1", [id(req)]);
    });
    await audit(u.id, "suspend-developer", null, null, reason);
    return { suspended: true };
  });
  app.post("/api/v1/admin/versions/:id/disable", async (req) => {
    const u = await user(req, "admin");
    const reason = z
      .object({ reason: z.string().min(5).max(500) })
      .parse(req.body).reason;
    const v = (
      await db.query(
        "UPDATE versions SET review_status='disabled',review_reason=$1 WHERE id=$2 RETURNING app_id",
        [reason, id(req)],
      )
    )[0];
    if (!v) fail(404, "Version not found");
    await db.query("UPDATE sessions SET expires_at=0 WHERE version_id=$1", [
      id(req),
    ]);
    await audit(u.id, "disable-version", v.app_id, id(req), reason);
    return { disabled: true };
  });
  app.get("/api/v1/admin/reports", async (req) => {
    await user(req, "admin");
    return db.query(
      "SELECT r.id,r.app_id,r.category,r.detail,r.status,r.created_at,a.title FROM reports r JOIN apps a ON a.id=r.app_id ORDER BY r.created_at DESC",
    );
  });
  app.post("/api/v1/admin/reports/:id/resolve", async (req) => {
    const u = await user(req, "admin");
    await db.query("UPDATE reports SET status='resolved' WHERE id=$1", [
      id(req),
    ]);
    await audit(u.id, "resolve-report", null, null, id(req));
    return { resolved: true };
  });
  app.get("/api/v1/admin/audit", async (req) => {
    await user(req, "admin");
    return db.query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 200");
  });
  app.get("/api/v1/runtime/key", async () => ({
    keyId: keys.keyId,
    publicKey: keys.publicKey,
  }));
  app.get("/seed-preview/:slug/:file", async (req, reply) => {
    const params = req.params as Row;
    const rows = await db.query(catalogSql + " AND a.slug=$1", [params.slug]);
    const row = rows[0];
    if (!row) fail(404, "Preview unavailable");
    const v = (
      await db.query("SELECT * FROM versions WHERE id=$1 AND seed=true", [
        row.version_id,
      ])
    )[0];
    if (!v) fail(403, "Uploaded bundles can only run in the Android host");
    const bundle = validateBundle(await store.get(v.bundle_hash));
    const bytes = bundle.files[params.file];
    if (!bytes) fail(404, "Asset unavailable");
    const mime = params.file.endsWith(".js")
      ? "text/javascript"
      : params.file.endsWith(".css")
        ? "text/css"
        : "text/html";
    reply.header("Content-Security-Policy", CSP + "; sandbox allow-scripts");
    return reply.type(mime).send(Buffer.from(bytes));
  });
  app.get("/api/v1/openapi.json", async () => ({
    openapi: "3.1.0",
    info: {
      title: "FirstTry local API",
      version: "0.1.0",
      description:
        "Local MVP. Cookie sessions for dashboards; signed bearer grants for runtime requests. Mutations require x-firsttry-request: 1.",
    },
    servers: [{ url: "http://127.0.0.1:3001" }],
    components: {
      schemas: {
        MiniManifest: z.toJSONSchema(
          (await import("@firsttry/shared")).manifestSchema,
        ),
        Listing: z.toJSONSchema(listingSchema),
        Feedback: z.toJSONSchema(feedbackSchema),
        Report: z.toJSONSchema(reportSchema),
        Event: z.toJSONSchema(eventSchema),
      },
      securitySchemes: {
        dashboard: { type: "apiKey", in: "cookie", name: "ft_session" },
        runtime: { type: "http", scheme: "bearer" },
      },
    },
    paths: Object.fromEntries(
      [...new Set(routes.map((r) => r.path))].map((path) => [
        path,
        Object.fromEntries(
          routes
            .filter((r) => r.path === path)
            .map((r) => [
              r.method,
              {
                summary: r.method.toUpperCase() + " " + path,
                parameters: [
                  ...Array.from(path.matchAll(/\{(\w+)\}/g)).map((m) => ({
                    name: m[1],
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                  })),
                  ...(!["get", "head"].includes(r.method)
                    ? [
                        {
                          name: "x-firsttry-request",
                          in: "header",
                          required: true,
                          schema: { type: "string", const: "1" },
                        },
                      ]
                    : []),
                ],
                responses: {
                  "200": { description: "Successful response" },
                  "400": { description: "Invalid request" },
                  "401": { description: "Authentication required" },
                  "403": { description: "Authorization denied" },
                  "409": { description: "State conflict" },
                },
              },
            ]),
        ),
      ]),
    ),
  }));
  return { app, db, store, keys };
}

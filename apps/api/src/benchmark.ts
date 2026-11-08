import { createApp } from "./app.js";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { root } from "./db.js";
const total = Number(process.env.BENCHMARK_EVENTS ?? 100000);
if (total % 100 !== 0 || total < 100)
  throw new Error("Use a positive multiple of 100 events");
const { app, db } = await createApp({ memory: true });
const started = performance.now();
const batches: number[] = [];
try {
  const guest = await app.inject({
    url: "/api/v1/auth/guest",
    method: "POST",
    headers: { "x-firsttry-request": "1" },
    payload: {},
  });
  const cookie = guest.cookies.map((c) => c.name + "=" + c.value).join("; ");
  const mini = (await app.inject("/api/v1/catalog"))
    .json()
    .items.find((a: any) => a.slug === "color-clash");
  for (let n = 0; n < total / 100; n++) {
    const response = await app.inject({
      url: "/api/v1/sessions",
      method: "POST",
      headers: { cookie, "x-firsttry-request": "1" },
      payload: { appId: mini.id },
    });
    if (response.statusCode !== 200) throw new Error(response.body);
    const grant = response.json();
    for (let batch = 0; batch < 5; batch++) {
      const begin = performance.now();
      const r = await app.inject({
        url: "/api/v1/events/batch",
        method: "POST",
        headers: {
          "x-firsttry-request": "1",
          authorization: "Bearer " + grant.payload + "." + grant.signature,
        },
        payload: {
          events: Array.from({ length: 20 }, () => ({
            id: randomUUID(),
            name: "round_completed",
            props: { scoreBucket: "medium" },
          })),
        },
      });
      if (r.statusCode !== 200) throw new Error(r.body);
      batches.push(performance.now() - begin);
    }
  }
  const stored = (await db.query("SELECT count(*)::int count FROM events"))[0]
    .count;
  if (stored !== total) throw new Error(`Expected ${total}, stored ${stored}`);
  batches.sort((a, b) => a - b);
  const results = {
    events: stored,
    sessions: total / 100,
    batches: batches.length,
    durationSeconds: Math.round((performance.now() - started) / 10) / 100,
    p50BatchMs: Math.round(batches[Math.floor(batches.length * 0.5)]),
    p95BatchMs: Math.round(batches[Math.floor(batches.length * 0.95)]),
    rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    environment:
      "single-process in-memory PostgreSQL, sequential Fastify injection; not network or production capacity",
  };
  await mkdir(resolve(root, "output"), { recursive: true });
  await writeFile(
    resolve(root, "output/benchmark.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await app.close();
}

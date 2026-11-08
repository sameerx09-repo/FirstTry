import { createApp } from "./app.js";
if (process.env.NODE_ENV === "production")
  throw new Error(
    "This local MVP server is not production configured. Complete the documented security/operations gates before deployment.",
  );
const { app } = await createApp();
await app.listen({
  port: Number(process.env.API_PORT ?? 3001),
  host: "127.0.0.1",
});
console.log("FirstTry local API http://127.0.0.1:3001");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void app.close().then(() => process.exit(0)));

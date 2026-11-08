import { Database } from "./db.js";
import { BundleStore } from "./bundles.js";
import { seed } from "./seeds.js";
const db = await Database.open();
try {
  await seed(db, new BundleStore());
  console.log("Six mini-apps seeded. See README for development accounts.");
} finally {
  await db.close();
}

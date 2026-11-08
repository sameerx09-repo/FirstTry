import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
import { manifestSchema } from "./index.js";
const sha = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
export function validateBundle(zip: Uint8Array) {
  if (zip.length > 2 * 1024 * 1024)
    throw new Error("Bundle exceeds 2 MB compressed");
  let expanded = 0,
    count = 0;
  const files = unzipSync(zip, {
    filter(info) {
      count++;
      expanded += info.originalSize;
      if (
        count > 64 ||
        expanded > 6 * 1024 * 1024 ||
        info.originalSize > 2 * 1024 * 1024
      )
        throw new Error("Archive expansion limits exceeded");
      if (
        !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(info.name) ||
        info.name.includes("..") ||
        info.name.includes("\\") ||
        info.name.split("/").length > 5 ||
        !/\.(html|js|css|json|png|webp|jpg|svg)$/.test(info.name)
      )
        throw new Error("Unsafe archive path or unsupported file");
      return true;
    },
  });
  const names = Object.keys(files);
  if (
    names.length !== count ||
    new Set(names.map((n) => n.toLowerCase())).size !== names.length
  )
    throw new Error("Duplicate archive paths");
  if (!files["manifest.json"] || !files["index.html"])
    throw new Error("Missing manifest.json or index.html");
  const manifest = manifestSchema.parse(
    JSON.parse(Buffer.from(files["manifest.json"]).toString()),
  );
  for (const [name, bytes] of Object.entries(files))
    if (/\.(html|js|css|svg)$/.test(name)) {
      const content = Buffer.from(bytes).toString();
      if (
        /\beval\s*\(|new\s+Function\b|\bimport\s*\(|https?:\/\/|\b(?:fetch|WebSocket|XMLHttpRequest|Worker|importScripts)\s*\(|\son\w+\s*=|<\s*(?:iframe|object|embed|base)\b|javascript:/i.test(
          content,
        )
      )
        throw new Error(`Disallowed code or network reference in ${name}`);
      if (
        name.endsWith(".html") &&
        /<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(content)
      )
        throw new Error("Scripts must be bundled external files");
    }
  const inventory = Object.fromEntries(
    Object.entries(files).map(([name, b]) => [
      name,
      { hash: sha(b), size: b.length },
    ]),
  );
  return { manifest, files, inventory, hash: sha(zip) };
}

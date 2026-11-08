import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { unzipSync, zipSync, strToU8 } from "fflate";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { manifestSchema } from "@firsttry/shared";
import { root } from "./db.js";
export const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'";
export const sha = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
export function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = passwordHash(password, salt).split(":")[1];
  return (
    hash.length === actual.length &&
    timingSafeEqual(Buffer.from(hash), Buffer.from(actual))
  );
}
export { validateBundle } from "@firsttry/shared/bundle";
import { validateBundle } from "@firsttry/shared/bundle";
export async function signingKeys(memory = false) {
  const path = resolve(root, ".local/signing-key.pem");
  let pem: string;
  if (memory)
    pem = generateKeyPairSync("ed25519")
      .privateKey.export({ format: "pem", type: "pkcs8" })
      .toString();
  else {
    try {
      pem = await readFile(path, "utf8");
    } catch {
      pem = generateKeyPairSync("ed25519")
        .privateKey.export({ format: "pem", type: "pkcs8" })
        .toString();
      await writeFile(path, pem, { mode: 0o600 });
    }
  }
  const privateKey = createPrivateKey(pem),
    publicKey = createPublicKey(privateKey),
    spki = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  return {
    publicKey: spki,
    keyId: sha(spki).slice(0, 16),
    seal(payload: unknown) {
      const encoded = Buffer.from(JSON.stringify(payload)).toString(
        "base64url",
      );
      return {
        payload: encoded,
        signature: sign(null, Buffer.from(encoded), privateKey).toString(
          "base64url",
        ),
      };
    },
    verify(payload: string, signature: string) {
      return verify(
        null,
        Buffer.from(payload),
        publicKey,
        Buffer.from(signature, "base64url"),
      );
    },
  };
}
export class BundleStore {
  private s3 =
    process.env.FIRSTTRY_STORAGE === "s3"
      ? new S3Client({
          endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
          region: "us-east-1",
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY ?? "firsttry-local",
            secretAccessKey:
              process.env.S3_SECRET_KEY ?? "local-firsttry-storage",
          },
        })
      : null;
  private bucket = process.env.S3_BUCKET ?? "firsttry-bundles";
  private async ensureBucket() {
    try {
      await this.s3!.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (e: any) {
      if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(e.name))
        throw e;
    }
  }
  constructor(
    private dir = resolve(root, ".local/bundles"),
    private memory = false,
  ) {}
  private map = new Map<string, Uint8Array>();
  async put(hash: string, zip: Uint8Array) {
    if (this.memory) {
      this.map.set(hash, zip);
      return;
    }
    if (this.s3) {
      await this.ensureBucket();
      try {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: hash + ".zip",
            Body: zip,
            ContentType: "application/zip",
            IfNoneMatch: "*",
          }),
        );
      } catch (e: any) {
        if (e.name !== "PreconditionFailed") throw e;
      }
      return;
    }
    await mkdir(this.dir, { recursive: true });
    try {
      await writeFile(resolve(this.dir, hash + ".zip"), zip, { flag: "wx" });
    } catch (e: any) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  async get(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid bundle hash");
    if (this.s3 && !this.memory) {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: hash + ".zip" }),
      );
      const bytes = await response.Body!.transformToByteArray();
      if (sha(bytes) !== hash) throw new Error("Bundle integrity mismatch");
      return bytes;
    }
    const bytes = this.memory
      ? this.map.get(hash)
      : await readFile(resolve(this.dir, hash + ".zip"));
    if (!bytes || sha(bytes) !== hash)
      throw new Error("Bundle integrity mismatch");
    return bytes;
  }
}
export function makeZip(files: Record<string, string>) {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([n, s]) => [n, strToU8(s)])),
  );
}

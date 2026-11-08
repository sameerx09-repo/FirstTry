import { z } from "zod";
export const categories = ["games", "fun", "creative", "utility"] as const;
export const manifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    name: z.string().min(2).max(70),
    description: z.string().min(5).max(180),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    runtime: z.literal("webview-v1"),
    entry: z.literal("index.html"),
    category: z.enum(categories),
    estimatedDurationSeconds: z.number().int().min(5).max(3600),
    ageRating: z.literal("general"),
    capabilities: z
      .array(
        z.enum(["host.theme", "host.analytics", "host.feedback", "host.close"]),
      )
      .max(4)
      .default([]),
    network: z.object({ allowedDomains: z.array(z.string()).max(0) }).strict(),
    assets: z
      .object({ icon: z.string().optional(), cover: z.string().optional() })
      .default({}),
  })
  .strict();
export type MiniManifest = z.infer<typeof manifestSchema>;
export const listingSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    title: z.string().min(2).max(70),
    summary: z.string().min(5).max(180),
    category: z.enum(categories),
  })
  .strict();
export const feedbackSchema = z
  .object({
    rating: z.enum(["up", "down"]),
    body: z.string().max(140).default(""),
  })
  .strict();
export const reportSchema = z
  .object({
    category: z.enum(["harmful", "scam", "privacy", "ip", "other"]),
    detail: z.string().max(500).default(""),
  })
  .strict();
export const eventSchema = z
  .object({
    id: z.uuid(),
    name: z.enum(["ready", "round_completed", "task_completed"]),
    props: z
      .record(
        z.string(),
        z.union([
          z.number().finite(),
          z.boolean(),
          z.enum(["low", "medium", "high"]),
        ]),
      )
      .refine((v) => Object.keys(v).length <= 5),
  })
  .strict();
export const allowedTransitions: Record<string, string[]> = {
  validated: ["pending"],
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
};
export function canTransition(from: string, to: string) {
  return allowedTransitions[from]?.includes(to) ?? false;
}
